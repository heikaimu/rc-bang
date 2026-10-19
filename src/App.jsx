import React from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Camera, Check, CircleUserRound,
  Copy, ImagePlus, LoaderCircle, LogOut, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Trash2, X,
} from 'lucide-react'
import { supabase } from './supabase'
import { compressImage } from './imageCompression'

const EMPTY_PROFILE = { nickname: '', wechat_id: '', group_names: [], avatar_url: '' }
const CATEGORIES = ['全部好物', '整车', '配件', '电装', '工具']
const RC_GROUPS = ['Radio电波通信交流群', 'UDR', '京商Nsr电单摩托交流群']

async function usernameToAuthEmail(username) {
  const normalized = username.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `u-${hash}@${new URL(import.meta.env.VITE_SUPABASE_URL).hostname}`
}

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date(date))
}

function listingStatusLabel(status) {
  if (status === 'sold') return '已售'
  if (status === 'withdrawn') return '已下架'
  return '售卖中'
}

function GroupMultiSelect({ value = [], onChange }) {
  const [custom, setCustom] = useState(value.some((group) => !RC_GROUPS.includes(group)))
  const customGroup = value.find((group) => !RC_GROUPS.includes(group)) ?? ''

  const toggleGroup = (group, checked) => {
    onChange(checked
      ? [...value, group]
      : value.filter((selected) => selected !== group))
  }
  return (
    <div className="group-multi-select">
      {RC_GROUPS.map((group) => (
        <label className="group-option" key={group}>
          <input type="checkbox" checked={value.includes(group)} onChange={(event) => toggleGroup(group, event.target.checked)} />
          <span>{group}</span>
        </label>
      ))}
      <label className="group-option">
        <input
          type="checkbox"
          checked={custom}
          onChange={(event) => {
            setCustom(event.target.checked)
            if (!event.target.checked && customGroup) onChange(value.filter((group) => group !== customGroup))
          }}
        />
        <span>其他（手动输入）</span>
      </label>
      {custom && (
        <input
          required
          maxLength="100"
          value={customGroup}
          onChange={(event) => {
            const nextName = event.target.value
            const normalizedName = nextName.trim()
            if (RC_GROUPS.includes(normalizedName)) {
              setCustom(false)
              onChange([...new Set([...value.filter((group) => RC_GROUPS.includes(group)), normalizedName])])
              return
            }
            onChange([...value.filter((group) => RC_GROUPS.includes(group)), ...(normalizedName ? [nextName] : [])])
          }}
          placeholder="请输入群名称"
        />
      )}
    </div>
  )
}

const AvatarCropper = forwardRef(function AvatarCropper({ currentUrl, nickname }, ref) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [bitmap, setBitmap] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')

  useEffect(() => () => bitmap?.close(), [bitmap])
  useEffect(() => {
    if (!bitmap || !canvasRef.current) return
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return
    const cropSize = Math.min(bitmap.width, bitmap.height) / zoom
    const maxX = (bitmap.width - cropSize) / 2
    const maxY = (bitmap.height - cropSize) / 2
    const sourceX = Math.min(bitmap.width - cropSize, Math.max(0, maxX - offset.x * cropSize / 200))
    const sourceY = Math.min(bitmap.height - cropSize, Math.max(0, maxY - offset.y * cropSize / 200))
    context.clearRect(0, 0, 200, 200)
    context.drawImage(bitmap, sourceX, sourceY, cropSize, cropSize, 0, 0, 200, 200)
  }, [bitmap, offset, zoom])

  useImperativeHandle(ref, () => ({
    crop: async () => {
      if (!bitmap || !canvasRef.current) return null
      return new Promise((resolve, reject) => {
        canvasRef.current.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('头像裁剪失败，请重试。')),
          'image/jpeg',
          0.88,
        )
      })
    },
  }), [bitmap])

  const chooseImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件。')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('头像原图不能超过 10 MB。')
      return
    }
    try {
      const nextBitmap = await createImageBitmap(file)
      setBitmap((current) => {
        current?.close()
        return nextBitmap
      })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setError('')
    } catch (imageError) {
      setError(`无法读取图片：${imageError.message}`)
    }
  }

  const startDrag = (event) => {
    if (!bitmap) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, offset }
  }

  const moveDrag = (event) => {
    if (!dragRef.current || !bitmap) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = 200 / rect.width
    const cropSize = Math.min(bitmap.width, bitmap.height) / zoom
    const maxX = (bitmap.width - cropSize) * 100 / cropSize
    const maxY = (bitmap.height - cropSize) * 100 / cropSize
    const nextX = dragRef.current.offset.x + (event.clientX - dragRef.current.x) * scale
    const nextY = dragRef.current.offset.y + (event.clientY - dragRef.current.y) * scale
    setOffset({ x: Math.max(-maxX, Math.min(maxX, nextX)), y: Math.max(-maxY, Math.min(maxY, nextY)) })
  }

  return (
    <div className="avatar-editor">
      <div className="avatar-crop-frame">
        {bitmap
          ? <canvas ref={canvasRef} width="200" height="200" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} aria-label="拖动裁剪头像" />
          : currentUrl
            ? <img src={currentUrl} alt={`${nickname}的头像`} />
            : <span className="avatar-placeholder">{(nickname || '车')[0]}</span>}
      </div>
      <div className="avatar-editor-controls">
        <label className="button button-outline avatar-upload-button"><Camera size={15} />{bitmap || currentUrl ? '更换头像' : '上传头像'}<input type="file" accept="image/*" onChange={chooseImage} /></label>
        {bitmap && <label className="avatar-zoom">缩放<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>}
        <span className="avatar-help">{bitmap ? '拖动图片调整裁剪位置' : '支持图片上传，保存为 200 × 200'}</span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
})

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [listings, setListings] = useState([])
  const [page, setPage] = useState('market')
  const [category, setCategory] = useState('全部好物')
  const [query, setQuery] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [listingOpen, setListingOpen] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [selectedListing, setSelectedListing] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const configured = Boolean(supabase)

  const notify = useCallback((message, type = 'success') => {
    setNotice({ message, type })
    window.setTimeout(() => setNotice(null), 3800)
  }, [])

  const loadListings = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false })
    if (error) {
      notify(`读取集市失败：${error.message}`, 'error')
      setLoading(false)
      return
    }
    setListings(data ?? [])
    setLoading(false)
  }, [notify])

  const loadProfile = useCallback(async (user) => {
    if (!user || !supabase) {
      setProfile(EMPTY_PROFILE)
      return
    }
    const { data, error } = await supabase.from('profiles').select('nickname, wechat_id, group_names, avatar_url').eq('id', user.id).maybeSingle()
    if (error) {
      notify(`读取个人资料失败：${error.message}`, 'error')
      return
    }
    setProfile({
      ...EMPTY_PROFILE,
      nickname: data?.nickname || user.user_metadata?.nickname || '',
      wechat_id: data?.wechat_id || user.user_metadata?.wechat_id || '',
      group_names: data?.group_names?.length ? data.group_names : user.user_metadata?.group_names ?? [],
      avatar_url: data?.avatar_url || '',
    })
  }, [notify])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!active) return
      setSession(currentSession)
      loadProfile(currentSession?.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      window.setTimeout(() => loadProfile(currentSession?.user), 0)
    })
    loadListings()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadListings, loadProfile])

  const visibleListings = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const result = listings.filter((item) => {
      if (item.status === 'withdrawn') return false
      const matchesCategory = category === '全部好物' || item.category === category
      const matchesQuery = !needle || `${item.title} ${item.description} ${item.category} ${(item.group_names ?? []).join(' ')}`.toLocaleLowerCase().includes(needle)
      return matchesCategory && matchesQuery
    })
    return result
  }, [category, listings, query])

  const openCreate = () => {
    if (!session) {
      setAuthOpen(true)
      return
    }
    setEditingListing(null)
    setListingOpen(true)
  }

  const uploadImages = async (images) => {
    const uploaded = []
    for (const image of images) {
      if (image.url) {
        uploaded.push(image.url)
        continue
      }
      const compressed = await compressImage(image.file)
      const path = `${session.user.id}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('rc-listing-images').upload(path, compressed, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) throw new Error(`上传图片失败：${error.message}`)
      const { data } = supabase.storage.from('rc-listing-images').getPublicUrl(path)
      uploaded.push(data.publicUrl)
    }
    return uploaded
  }

  const saveListing = async (form) => {
    if (!supabase || !session) return
    const accountProfile = {
      nickname: profile.nickname || session.user.user_metadata?.nickname || '',
      wechat_id: profile.wechat_id || session.user.user_metadata?.wechat_id || '',
      group_names: profile.group_names?.length ? profile.group_names : session.user.user_metadata?.group_names ?? [],
    }
    if (!accountProfile.wechat_id || !accountProfile.group_names.length) {
      setListingOpen(false)
      setProfileOpen(true)
      notify('请先在个人资料中补充微信号和所在群，再发布商品。', 'error')
      return
    }
    setBusy(true)
    try {
      const images = await uploadImages(form.images)
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        images,
        seller_name: accountProfile.nickname || 'RC 车友',
        seller_avatar_url: profile.avatar_url || '',
        wechat_id: accountProfile.wechat_id,
        group_names: accountProfile.group_names,
        xianyu_url: form.xianyu_url,
      }
      const result = editingListing
        ? await supabase.from('listings').update(payload).eq('id', editingListing.id).eq('user_id', session.user.id)
        : await supabase.from('listings').insert({ ...payload, user_id: session.user.id })
      if (result.error) throw result.error
      await loadListings()
      setListingOpen(false)
      setEditingListing(null)
      notify(editingListing ? '修改已保存' : '发布成功，祝爱车早日找到新主人')
    } catch (error) {
      notify(`保存失败：${error.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (item, status) => {
    const { error } = await supabase.from('listings').update({ status }).eq('id', item.id).eq('user_id', session.user.id)
    if (error) {
      notify(`更新状态失败：${error.message}`, 'error')
      return
    }
    setListings((current) => current.map((listing) => listing.id === item.id ? { ...listing, status } : listing))
    setSelectedListing((current) => current?.id === item.id ? { ...current, status } : current)
    notify(`商品状态已更新为：${listingStatusLabel(status)}`)
  }

  const removeListing = async (item) => {
    if (!window.confirm('确定要删除这条发布吗？此操作无法撤销。')) return
    const { error } = await supabase.from('listings').delete().eq('id', item.id).eq('user_id', session.user.id)
    if (error) {
      notify(`删除失败：${error.message}`, 'error')
      return
    }
    setListings((current) => current.filter((listing) => listing.id !== item.id))
    setSelectedListing(null)
    notify('发布已删除')
  }

  const saveProfile = async (nextProfile, avatarBlob) => {
    setBusy(true)
    let uploadedAvatarPath = null
    let previousAvatarPath = null
    let profileSaved = false
    try {
      let avatarUrl = profile.avatar_url || null
      if (avatarBlob) {
        if (profile.avatar_url) {
          try {
            const pathname = new URL(profile.avatar_url).pathname
            const marker = '/storage/v1/object/public/rc-avatars/'
            const markerIndex = pathname.indexOf(marker)
            const candidate = markerIndex === -1 ? '' : decodeURIComponent(pathname.slice(markerIndex + marker.length))
            if (candidate.startsWith(`${session.user.id}/`)) previousAvatarPath = candidate
          } catch (error) {
            console.warn('Could not identify the previous avatar for cleanup:', error.message)
          }
        }
        uploadedAvatarPath = `${session.user.id}/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage.from('rc-avatars').upload(uploadedAvatarPath, avatarBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        })
        if (uploadError) throw new Error(`头像上传失败：${uploadError.message}`)
        avatarUrl = `${supabase.storage.from('rc-avatars').getPublicUrl(uploadedAvatarPath).data.publicUrl}?v=${Date.now()}`
      }
      const values = {
        nickname: nextProfile.nickname.trim(),
        wechat_id: nextProfile.wechat_id.trim(),
        group_names: nextProfile.group_names,
        avatar_url: avatarUrl,
      }
      const { error } = await supabase.from('profiles').upsert({ id: session.user.id, ...values })
      if (error) throw error
      profileSaved = true
      setProfile(values)
      const { error: listingsError } = await supabase.from('listings').update({
        seller_name: values.nickname,
        seller_avatar_url: values.avatar_url,
        wechat_id: values.wechat_id,
        group_names: values.group_names,
      }).eq('user_id', session.user.id)
      if (listingsError) throw listingsError
      setListings((current) => current.map((listing) => listing.user_id === session.user.id
        ? { ...listing, seller_name: values.nickname, seller_avatar_url: values.avatar_url, wechat_id: values.wechat_id, group_names: values.group_names }
        : listing))
      await loadListings()
      if (uploadedAvatarPath && previousAvatarPath && previousAvatarPath !== uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage.from('rc-avatars').remove([previousAvatarPath])
        if (cleanupError) console.error('Failed to remove the previous avatar:', cleanupError.message)
      }
      setProfileOpen(false)
      notify('个人资料已更新')
    } catch (error) {
      if (uploadedAvatarPath && !profileSaved) {
        const { error: cleanupError } = await supabase.storage.from('rc-avatars').remove([uploadedAvatarPath])
        if (cleanupError) console.error('Failed to clean up an unreferenced avatar:', cleanupError.message)
      }
      notify(`保存失败：${error.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) notify(`退出失败：${error.message}`, 'error')
    else {
      setPage('market')
      notify('已退出登录')
    }
  }

  const myListings = listings.filter((item) => item.user_id === session?.user?.id)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('market') }}>
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-name">RC帮<span className="brand-dot">.</span></span>
        </a>
        <nav className="main-nav" aria-label="主导航">
          <button className={page === 'market' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('market')}>逛集市</button>
          <button className={page === 'manage' ? 'nav-link active' : 'nav-link'} onClick={() => { setPage('manage'); if (!session) setAuthOpen(true) }}>我的发布</button>
        </nav>
        <div className="header-actions">
          {session ? (
            <button className="user-chip" onClick={() => setPage('manage')} title={profile.nickname || session.user.user_metadata?.nickname || '车友'}>
              {profile.avatar_url
                ? <img className="avatar" src={profile.avatar_url} alt="" />
                : <span className="avatar">{(profile.nickname || session.user.user_metadata?.nickname || '车')[0].toUpperCase()}</span>}
              <span className="user-chip-name">{profile.nickname || '车友'}</span>
            </button>
          ) : (
            <button className="sign-in-link" onClick={() => setAuthOpen(true)}><CircleUserRound size={17} /> 登录 / 注册</button>
          )}
          <button className="button button-primary header-publish" onClick={openCreate}><Plus size={17} /> 发布闲置</button>
          {session && <button className="icon-button sign-out" onClick={signOut} aria-label="退出登录" title="退出登录"><LogOut size={17} /></button>}
        </div>
      </header>

      <main>
        {page === 'market' ? (
          <section className="market-section" id="marketplace">
            <div className="section-heading">
              <div><h1>RC帮集市</h1><p>看看车友们最近在出什么好物。</p></div>
            </div>
              <div className="market-toolbar">
                <div className="category-tabs">
                  {CATEGORIES.map((item) => <button key={item} className={category === item ? 'category-tab selected' : 'category-tab'} onClick={() => setCategory(item)}>{item}</button>)}
                </div>
                <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜一搜车、配件或关键词" /><span className="search-shortcut"><SlidersHorizontal size={13} /></span></label>
              </div>
              {!configured ? (
                <div className="setup-message"><Settings2 size={20} /><div><b>还差一步就能开张啦</b><p>请先配置 Supabase 环境变量，并在项目数据库中运行 <code>supabase/schema.sql</code>。</p></div></div>
              ) : loading ? (
                <div className="loading-state"><LoaderCircle className="spin" size={22} />正在打开车友车库…</div>
              ) : visibleListings.length === 0 ? (
                <div className="empty-market">
                  <h3>{query ? '没有找到相关商品' : listings.some((item) => item.status !== 'withdrawn') ? '这个分类暂时没有商品' : '集市还没有发布商品'}</h3>
                  <p>{query ? '换个关键词试试看。' : '有闲置 RC 想出售？发布商品，让车友看到。'}</p>
                </div>
              ) : (
                <div className="listing-grid">
                  {visibleListings.map((item) => <ListingCard key={item.id} item={item} onClick={() => setSelectedListing(item)} />)}
                </div>
              )}
          </section>
        ) : (
          <section className="manage-section">
            <div className="manage-heading">
              <div><h1>我的发布<span className="heading-count">{myListings.length.toString().padStart(2, '0')}</span></h1><p>管理你发布的商品。</p></div>
              {session && <div className="manage-actions"><button className="button button-outline" onClick={() => setProfileOpen(true)}><Settings2 size={16} />个人资料</button></div>}
            </div>
            {!session ? (
              <div className="manage-login"><CircleUserRound size={28} /><h3>登录后查看你的发布</h3><p>发布闲置、编辑信息，或标记物品已出。</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>登录 / 注册 <ArrowRight size={16} /></button></div>
            ) : myListings.length === 0 ? (
              <div className="empty-market manage-empty"><h3>你还没有发布商品</h3><p>点击右上角“发布闲置”开始发布。</p></div>
            ) : (
              <div className="manage-list">
                {myListings.map((item) => <ManageRow key={item.id} item={item} onEdit={() => { setEditingListing(item); setListingOpen(true) }} onStatus={(status) => changeStatus(item, status)} onDelete={() => removeListing(item)} onOpen={() => setSelectedListing(item)} />)}
              </div>
            )}
            {session && <button className="manage-signout" onClick={signOut}><LogOut size={15} />退出登录</button>}
          </section>
        )}
      </main>
      <footer className="disclaimer-banner">
        <strong>交易提醒</strong>
        <p>RC帮仅作为群友闲置信息的整合展示平台，不参与、不担保任何交易。交易前请仔细核实商品信息和卖家身份，谨慎交易，注意资金与个人信息安全。</p>
      </footer>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={(message) => { setAuthOpen(false); notify(message) }} />}
      {listingOpen && <ListingModal
        listing={editingListing}
        busy={busy}
        onClose={() => { setListingOpen(false); setEditingListing(null) }}
        onSave={saveListing}
      />}
      {profileOpen && <ProfileModal profile={profile} busy={busy} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
      {selectedListing && <ListingDetail item={selectedListing} onClose={() => setSelectedListing(null)} onContact={notify} />}
      {notice && <div className={`toast ${notice.type === 'error' ? 'toast-error' : ''}`}><span>{notice.type === 'error' ? '!' : <Check size={15} />}</span>{notice.message}<button onClick={() => setNotice(null)} aria-label="关闭提示"><X size={15} /></button></div>}
    </div>
  )
}

function ListingCard({ item, onClick }) {
  return (
    <button className={`listing-card ${item.status === 'sold' ? 'is-sold' : ''}`} onClick={onClick}>
      <div className="card-image">
        {item.images?.[0] ? <img src={item.images[0]} alt={item.title} loading="lazy" /> : <div className="image-placeholder"><span>RC</span></div>}
        <span className="card-category">{item.category}</span>
        {item.status === 'sold' && <span className="sold-ribbon">已售</span>}
        {item.images?.length > 1 && <span className="image-count">▧ {item.images.length}</span>}
        <span className="card-open"><ArrowRight size={17} /></span>
      </div>
      <div className="card-body">
        <div className="card-title-row"><h3>{item.title}</h3><span className="card-price">¥{Number(item.price).toLocaleString()}</span></div>
        <p className="card-description">{item.description}</p>
        <div className="card-meta">
          {item.seller_avatar_url
            ? <img className="seller-avatar" src={item.seller_avatar_url} alt="" loading="lazy" />
            : <span className="seller-avatar">{(item.seller_name || '车')[0]}</span>}
          <span className="card-seller-name">{item.seller_name || 'RC 车友'}</span>
          <i />
          <span className="card-group-names" title={(item.group_names ?? []).join('、')}>{(item.group_names ?? []).join('、') || '车友群'}</span>
          <time>{formatDate(item.created_at)}</time>
        </div>
      </div>
    </button>
  )
}

function ManageRow({ item, onEdit, onStatus, onDelete, onOpen }) {
  const status = item.status || 'available'
  return (
    <article className="manage-row">
      <button className="manage-thumb" onClick={onOpen}>{item.images?.[0] ? <img src={item.images[0]} alt="" loading="lazy" /> : <span>RC</span>}</button>
      <button className="manage-info" onClick={onOpen}><span className="manage-category">{item.category} <i /> {formatDate(item.created_at)}</span><b>{item.title}</b><span className="manage-description">{item.description}</span></button>
      <span className="manage-price">¥{Number(item.price).toLocaleString()}</span>
      <label className={`status-control status-${status}`}><span className="status-pill"><i />{listingStatusLabel(status)}</span><select aria-label="商品状态" value={status} onChange={(event) => onStatus(event.target.value)}><option value="available">售卖中</option><option value="sold">已售</option><option value="withdrawn">下架</option></select></label>
      <div className="manage-controls"><button onClick={onEdit}>编辑</button><button className="delete-control" onClick={onDelete} aria-label="删除"><Trash2 size={16} /></button></div>
    </article>
  )
}

function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [wechat, setWechat] = useState('')
  const [groups, setGroups] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const loginName = username.normalize('NFKC').trim()
      if (loginName.length < 2 || loginName.length > 40) {
        throw new Error('微信昵称请填写 2 到 40 个字符。')
      }
      const selectedGroups = [...new Set(groups.map((group) => group.trim()).filter(Boolean))]
      if (mode === 'register' && !selectedGroups.length) {
        throw new Error('请至少选择或填写一个所在群。')
      }
      const email = await usernameToAuthEmail(loginName)
      if (mode === 'register') {
        const { data, error: authError } = await supabase.functions.invoke('register-nickname', {
          body: {
            nickname: loginName,
            password,
            wechat_id: wechat.trim(),
            group_names: selectedGroups,
          },
        })
        if (authError) {
          const responseBody = authError.context instanceof Response
            ? await authError.context.clone().json().catch(() => null)
            : null
          const errorMessage = responseBody?.error ?? data?.error ?? authError.message
          if (/already|registered/i.test(errorMessage)) {
            throw new Error('这个微信昵称已经注册，请直接登录。')
          }
          if (/rate limit|一小时后/i.test(errorMessage)) {
            throw new Error(errorMessage)
          }
          if (authError.name === 'FunctionsFetchError') {
            throw new Error('昵称注册服务尚未部署，请按项目 README 中的步骤部署 Supabase Edge Function。')
          }
          throw new Error(errorMessage)
        }
        if (!data?.session) throw new Error('注册服务没有返回登录会话，请稍后重试。')
        const { error: sessionError } = await supabase.auth.setSession(data.session)
        if (sessionError) throw sessionError
        onSuccess('注册成功，欢迎加入车友集市！')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        onSuccess('欢迎回来，车友！')
      }
    } catch (authError) {
      const message = authError.message || ''
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalFrame onClose={onClose} size="auth-modal">
      <div className="modal-topline"><span>RC COMMUNITY / ACCOUNT</span><button onClick={onClose} aria-label="关闭"><X size={19} /></button></div>
      <div className="auth-mark"><span className="brand-mark"><span /><span /><span /></span></div>
      <div className="modal-kicker">{mode === 'login' ? 'GOOD TO SEE YOU AGAIN' : 'WELCOME TO THE GARAGE'}</div>
      <h2>{mode === 'login' ? '车友，欢迎回来。' : '一起加入车友集市。'}</h2>
      <p className="auth-intro">{mode === 'login' ? '用注册时填写的微信昵称和密码登录。' : '设置微信昵称和密码，即可加入车友集市。'}</p>
      <form className="form-stack" onSubmit={submit}>
        <label>微信昵称<input required minLength="2" maxLength="40" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="注册时使用的微信昵称" /></label>
        {mode === 'register' && <div className="form-row"><label>微信号<input required maxLength="100" value={wechat} onChange={(event) => setWechat(event.target.value)} placeholder="方便车友联系" /></label><div className="group-field"><span>所在群</span><GroupMultiSelect value={groups} onChange={setGroups} /></div></div>}
        <label>密码<input required type="password" minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary full-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : null}{mode === 'login' ? '登录集市' : '创建车友账号'}<ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">{mode === 'login' ? '还没有账号？' : '已经有账号了？'}<button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? '立即注册' : '去登录'}</button></p>
      <div className="auth-privacy"><ShieldCheck size={14} />昵称用于登录且不能重复；请记住密码，暂不支持邮箱找回。</div>
    </ModalFrame>
  )
}

function ListingModal({ listing, busy, onClose, onSave }) {
  const [title, setTitle] = useState(listing?.title ?? '')
  const [description, setDescription] = useState(listing?.description ?? '')
  const [price, setPrice] = useState(listing?.price ?? '')
  const [xianyuUrl, setXianyuUrl] = useState(listing?.xianyu_url ?? '')
  const [category, setCategory] = useState(listing?.category ?? '整车')
  const [images, setImages] = useState((listing?.images ?? []).map((url) => ({ url })))
  const [error, setError] = useState('')
  const previews = useMemo(() => images.map((image) => image.url || URL.createObjectURL(image.file)), [images])
  useEffect(() => () => previews.forEach((url, index) => { if (!images[index]?.url) URL.revokeObjectURL(url) }), [images, previews])

  const addImages = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (images.length + files.length > 5) {
      setError('最多上传 5 张图片，请先移除多余图片。')
      event.target.value = ''
      return
    }
    setError('')
    setImages((current) => [...current, ...files.map((file) => ({ file }))])
    event.target.value = ''
  }
  const removeImage = (index) => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))
  const submit = (event) => {
    event.preventDefault()
    if (images.length === 0) {
      setError('请至少上传 1 张商品图片。')
      return
    }
    const normalizedUrl = xianyuUrl.trim()
    if (normalizedUrl) {
      try {
        const parsedUrl = new URL(normalizedUrl)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
      } catch {
        setError('闲鱼链接格式不正确，请填写以 http:// 或 https:// 开头的完整链接。')
        return
      }
    }
    onSave({ title, description, price, category, images, xianyu_url: normalizedUrl })
  }

  return (
    <ModalFrame onClose={onClose} size="listing-modal">
      <div className="modal-topline"><span>THE COMMUNITY GARAGE</span><button onClick={onClose} aria-label="关闭"><X size={19} /></button></div>
      <div className="modal-kicker">{listing ? 'EDIT YOUR LISTING' : 'PASS IT ON'}</div>
      <h2>{listing ? '编辑这件好物' : '让好物，继续上路。'}</h2>
      <p className="modal-subtitle">实拍、描述清楚一点，下一位车友更容易找到它。</p>
      <form className="form-stack listing-form" onSubmit={submit}>
        <div className="upload-label-row"><label className="form-section-label">商品图片 <span>最多 5 张 · 图片自动压缩到 1080p</span></label><span className="image-limit">{images.length} / 5</span></div>
        <div className="image-uploader">
          {images.map((image, index) => <div className="upload-preview" key={image.url || `${image.file.name}-${index}`}><img src={previews[index]} alt={`图片 ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label="移除图片"><X size={14} /></button><span>{index === 0 ? '封面' : `0${index + 1}`}</span></div>)}
          {images.length < 5 && <label className="upload-tile"><ImagePlus size={21} /><span>添加照片</span><small>JPG / PNG / WEBP</small><input type="file" accept="image/*" multiple onChange={addImages} /></label>}
        </div>
        <label>标题<input required maxLength="80" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：Axial SCX10 III 越野车" /></label>
        <div className="form-row listing-fields"><label>分类<select value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>售价 <span className="currency-input"><i>¥</i><input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></span></label></div>
        <label>闲鱼链接 <span className="optional-label">选填</span><input type="url" maxLength="1000" value={xianyuUrl} onChange={(event) => setXianyuUrl(event.target.value)} placeholder="粘贴这件商品的闲鱼链接" /></label>
        <label>描述<textarea required maxLength="1200" rows="4" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="车况、改装、配件、交易方式……把车友关心的说清楚。" /><small className="field-hint">{description.length} / 1200</small></label>
        <div className="contact-notice"><ShieldCheck size={15} /><span>发布时会自动使用你的个人资料中的微信号和所在群。</span></div>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary full-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} />正在压缩并发布…</> : <>{listing ? '保存修改' : '发布到车友集市'}<ArrowRight size={16} /></>}</button>
      </form>
    </ModalFrame>
  )
}

function ProfileModal({ profile, busy, onClose, onSave }) {
  const avatarCropper = useRef(null)
  const [nickname, setNickname] = useState(profile.nickname)
  const [wechat, setWechat] = useState(profile.wechat_id)
  const [groups, setGroups] = useState(profile.group_names ?? [])
  const [avatarError, setAvatarError] = useState('')
  return (
    <ModalFrame onClose={onClose} size="auth-modal">
      <div className="modal-topline"><span>YOUR ACCOUNT / PROFILE</span><button onClick={onClose} aria-label="关闭"><X size={19} /></button></div>
      <div className="modal-kicker">KEEP YOUR DETAILS UP TO DATE</div><h2>车友资料</h2><p className="modal-subtitle">更新后也会同步到你已发布的商品。</p>
      <form className="form-stack profile-form" onSubmit={async (event) => {
        event.preventDefault()
        if (!groups.length) return
        try {
          const avatarBlob = await avatarCropper.current?.crop()
          onSave({ nickname, wechat_id: wechat, group_names: groups.map((group) => group.trim()).filter(Boolean) }, avatarBlob)
        } catch (error) {
          setAvatarError(error.message)
        }
      }}>
        <AvatarCropper ref={avatarCropper} currentUrl={profile.avatar_url} nickname={nickname} />
        {avatarError && <p className="form-error">{avatarError}</p>}
        <label>车友昵称<input required maxLength="40" value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
        <label>微信号<input required maxLength="100" value={wechat} onChange={(event) => setWechat(event.target.value)} /></label>
        <div className="group-field"><span>所在群</span><GroupMultiSelect value={groups} onChange={setGroups} /></div>
        <button className="button button-primary full-button" disabled={busy || groups.length === 0}>{busy ? '正在保存…' : '保存资料'}<Check size={16} /></button>
      </form>
    </ModalFrame>
  )
}

function ListingDetail({ item, onClose, onContact }) {
  const [imageIndex, setImageIndex] = useState(0)
  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(item.wechat_id)
      onContact('微信号已复制，可以去联系这位车友。')
    } catch {
      onContact(`车友微信号：${item.wechat_id}`, 'error')
    }
  }
  const photos = item.images?.length ? item.images : []
  return (
    <ModalFrame onClose={onClose} size="detail-modal">
      <div className="detail-layout">
        <div className="detail-gallery">
          {photos[imageIndex] ? <img className="detail-main-image" src={photos[imageIndex]} alt={item.title} /> : <div className="image-placeholder detail-placeholder"><span>RC</span></div>}
          <button className="gallery-close" onClick={onClose} aria-label="关闭"><X size={19} /></button>
          {photos.length > 1 && <><button className="gallery-arrow gallery-prev" onClick={() => setImageIndex((imageIndex - 1 + photos.length) % photos.length)} aria-label="上一张"><ArrowLeft size={17} /></button><button className="gallery-arrow gallery-next" onClick={() => setImageIndex((imageIndex + 1) % photos.length)} aria-label="下一张"><ArrowRight size={17} /></button><div className="gallery-dots">{photos.map((_, index) => <button key={index} className={index === imageIndex ? 'gallery-dot active' : 'gallery-dot'} onClick={() => setImageIndex(index)} aria-label={`第 ${index + 1} 张`} />)}</div></>}
          <span className="detail-photo-count">{String(imageIndex + 1).padStart(2, '0')} / {String(photos.length || 1).padStart(2, '0')}</span>
        </div>
        <div className="detail-copy">
          <div className="modal-topline"><span>{item.category} / RC COMMUNITY</span><span className={`detail-status detail-${item.status || 'available'}`}><i />{listingStatusLabel(item.status)}</span></div>
          <div className="detail-date">发布于 {formatDate(item.created_at)}</div>
          <h2>{item.title}</h2><div className="detail-price">¥{Number(item.price).toLocaleString()}</div>
          <div className="detail-divider" />
          <div className="detail-description-label">ABOUT THIS ITEM</div><p className="detail-description">{item.description}</p>
          <div className="detail-divider" />
          <div className="seller-block">
            {item.seller_avatar_url
              ? <img className="seller-avatar seller-large" src={item.seller_avatar_url} alt="" />
              : <span className="seller-avatar seller-large">{(item.seller_name || '车')[0]}</span>}
            <div><b>{item.seller_name || 'RC 车友'}</b><span>共同群聊：{(item.group_names ?? []).join('、') || '未填写'}</span></div>
            <span className="seller-badge"><ShieldCheck size={13} />同群车友</span>
          </div>
          <div className="contact-card"><span>WECHAT ID</span><b>{item.wechat_id || '未填写'}</b><button disabled={!item.wechat_id || item.status !== 'available'} onClick={copyContact}>{item.status !== 'available' ? listingStatusLabel(item.status) : <><Copy size={15} />复制微信号</>}</button></div>
          {item.xianyu_url && <a className="xianyu-link" href={item.xianyu_url} target="_blank" rel="noreferrer noopener">前往闲鱼查看商品 <ArrowRight size={14} /></a>}
          <p className="detail-tip">建议先在群内确认车况和交易方式，安心交易。</p>
        </div>
      </div>
    </ModalFrame>
  )
}

function ModalFrame({ children, onClose, size }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className={`modal-panel ${size}`} role="dialog" aria-modal="true">{children}</div></div>
}

export default App
