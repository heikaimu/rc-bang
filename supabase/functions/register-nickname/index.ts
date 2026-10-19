import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: '注册服务配置不完整。' }, 500)
  }

  try {
    const input = await request.json()
    const nickname = typeof input.nickname === 'string' ? input.nickname.normalize('NFKC').trim() : ''
    const password = typeof input.password === 'string' ? input.password : ''
    const wechatId = typeof input.wechat_id === 'string' ? input.wechat_id.trim() : ''
    const groupNames = Array.isArray(input.group_names)
      ? [...new Set(input.group_names.filter((value: unknown): value is string => typeof value === 'string').map((value: string) => value.trim()).filter(Boolean))]
      : []

    if (nickname.length < 2 || nickname.length > 40) {
      return jsonResponse({ error: '微信昵称请填写 2 到 40 个字符。' }, 400)
    }
    if (password.length < 6 || password.length > 128) {
      return jsonResponse({ error: '密码长度需要在 6 到 128 个字符之间。' }, 400)
    }
    if (!wechatId || wechatId.length > 100) {
      return jsonResponse({ error: '请填写有效的微信号。' }, 400)
    }
    if (!groupNames.length || groupNames.length > 10 || groupNames.some((group: string) => group.length > 100)) {
      return jsonResponse({ error: '请至少选择一个所在群，每个群名最多 100 个字符。' }, 400)
    }

    const ip = request.headers.get('x-real-ip')
      ?? request.headers.get('cf-connecting-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
    if (!ip) return jsonResponse({ error: '无法验证请求来源，请稍后重试。' }, 400)

    const ipHash = await sha256(`${serviceRoleKey}:${ip}`)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: allowed, error: limitError } = await admin.rpc('consume_nickname_signup_attempt', {
      p_ip_hash: ipHash,
    })
    if (limitError) {
      console.error('Signup rate-limit check failed:', limitError.message)
      return jsonResponse({ error: '注册服务暂时不可用，请稍后重试。' }, 503)
    }
    if (!allowed) return jsonResponse({ error: '注册太频繁，请一小时后再试。' }, 429)

    const nicknameKey = nickname.toLocaleLowerCase('zh-CN')
    const email = `u-${await sha256(nicknameKey)}@${new URL(supabaseUrl).hostname}`
    const userMetadata = {
      nickname,
      wechat_id: wechatId,
      group_names: groupNames,
    }
    let userId: string
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })
    if (createError) {
      const duplicate = /already|registered|exists/i.test(createError.message)
      if (!duplicate) {
        console.error('Nickname account creation failed:', createError.message)
        return jsonResponse({ error: '创建账号失败，请稍后重试。' }, 400)
      }

      let existingUser = null
      for (let page = 1; page <= 20; page += 1) {
        const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        })
        if (listError) {
          console.error('Could not look up the existing nickname account:', listError.message)
          return jsonResponse({ error: '无法检查现有账号，请稍后重试。' }, 503)
        }
        existingUser = usersPage.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
        if (existingUser || usersPage.users.length < 1000) break
      }

      if (!existingUser) {
        console.error('Auth reported a duplicate nickname but no matching account was found.')
        return jsonResponse({ error: '这个微信昵称已被占用，请联系管理员处理。' }, 409)
      }
      if (existingUser.email_confirmed_at) {
        return jsonResponse({ error: '这个微信昵称已经注册，请使用原密码登录。' }, 409)
      }

      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { ...existingUser.user_metadata, ...userMetadata },
      })
      if (updateError) {
        console.error('Could not activate the pending nickname account:', updateError.message)
        return jsonResponse({ error: '无法恢复此前未完成的注册，请联系管理员。' }, 500)
      }
      userId = updated.user.id
    } else {
      userId = created.user.id
    }

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({ email, password })
    if (signInError || !signedIn.session) {
      if (!createError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(userId)
        if (cleanupError) console.error('Failed to clean up a newly created account:', cleanupError.message)
      }
      console.error('New account could not be signed in:', signInError?.message ?? 'No session returned')
      return jsonResponse({ error: '账号已准备好，但自动登录失败，请使用刚才填写的昵称和密码登录。' }, 500)
    }

    return jsonResponse({ session: signedIn.session }, 201)
  } catch (error) {
    console.error('Nickname registration failed:', error instanceof Error ? error.message : 'Unknown error')
    return jsonResponse({ error: '注册请求处理失败，请检查填写内容后重试。' }, 400)
  }
})
