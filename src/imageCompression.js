const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} 不是有效的图片文件`)
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('当前浏览器无法处理图片')
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error(`无法压缩图片：${file.name}`)),
        'image/jpeg',
        0.8,
      )
    })
    canvas.width = 0
    canvas.height = 0
    return blob
  } finally {
    bitmap.close()
  }
}
