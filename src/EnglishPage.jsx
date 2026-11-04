import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search, Volume2 } from 'lucide-react'
import words from '../rc_english_100.json'

const CATEGORY_NAMES = { parts: '车辆零件', electronics: '电子设备', handling: '操控调校', maintenance: '维护保养', video: '视频常用词' }
const STORAGE_KEY = 'rc-english-mastered-v1'

export default function EnglishPage() {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [showTranslation, setShowTranslation] = useState(true)
  const [revealed, setRevealed] = useState([])
  const [slow, setSlow] = useState(false)
  const [speaking, setSpeaking] = useState('')
  const [message, setMessage] = useState('')
  const utteranceRef = useRef(null)
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const [mastered, setMastered] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      return Array.isArray(saved) ? saved.filter((id) => words.some((word) => word.id === id)) : []
    } catch { return [] }
  })

  useEffect(() => () => {
    utteranceRef.current = null
    if (speechSupported) window.speechSynthesis.cancel()
  }, [speechSupported])

  const filteredWords = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return words.filter((word) => (category === 'all' || word.category === category)
      && (!onlyNew || !mastered.includes(word.id))
      && [word.word, word.meaning, word.example, word.translation].some((text) => text.toLowerCase().includes(keyword)))
  }, [category, query, onlyNew, mastered])

  function toggleMastered(id) {
    const next = mastered.includes(id) ? mastered.filter((value) => value !== id) : [...mastered, id]
    setMastered(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
    catch { setMessage('当前浏览器无法保存进度，本次学习仍可继续。') }
  }

  function speak(text, key) {
    if (!speechSupported) return
    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(/^[A-Z]{2,}$/.test(text) ? text.split('').join(' ') : text)
    utterance.lang = 'en-US'
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((item) => item.lang === 'en-US') || voices.find((item) => /^en[-_]/i.test(item.lang))
    if (voice) utterance.voice = voice
    utterance.rate = slow ? 0.7 : 0.9
    utterance.onend = () => {
      if (utteranceRef.current === utterance) { setSpeaking(''); utteranceRef.current = null }
    }
    utterance.onerror = (event) => {
      if (utteranceRef.current !== utterance) return
      setSpeaking('')
      utteranceRef.current = null
      if (!['canceled', 'interrupted'].includes(event.error)) setMessage('发音未能播放，请检查设备的英语语音设置后重试。')
    }
    utteranceRef.current = utterance
    setMessage('')
    setSpeaking(key)
    try { window.speechSynthesis.speak(utterance) }
    catch { setSpeaking(''); setMessage('发音未能播放，请检查设备的英语语音设置后重试。') }
  }

  return (
    <section className="english-page">
      <div className="english-heading">
        <div><span className="section-kicker">RC ENGLISH / 从兴趣开始学英语</span><h1>读懂你的 RC 世界<span className="heading-count">{words.length} 词</span></h1><p>认识零件，理解调校。点一下听发音，在例句里记住每个词。</p></div>
        <div className="english-progress"><strong>{mastered.length}<small> / {words.length}</small></strong><span>已掌握 · 进度保存在此浏览器</span><progress value={mastered.length} max={words.length} aria-label="单词掌握进度" /></div>
      </div>
      <div className="manual-brand-filters" aria-label="单词分类">
        {['all', ...new Set(words.map((word) => word.category))].map((value) => <button key={value} className={`manual-brand-filter${category === value ? ' selected' : ''}`} aria-pressed={category === value} onClick={() => setCategory(value)}>{value === 'all' ? '全部单词' : CATEGORY_NAMES[value] || value}<span className="english-category-count">{words.filter((word) => value === 'all' || word.category === value).length}</span></button>)}
      </div>
      <div className="english-toolbar">
        <label className="search-box"><Search size={16} /><input aria-label="搜索英语单词、中文或例句" placeholder="搜索单词、中文或例句…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="english-options">
          <label><input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />只看未掌握</label>
          <label><input type="checkbox" checked={showTranslation} onChange={(event) => { setShowTranslation(event.target.checked); setRevealed([]) }} />显示翻译</label>
          <label><input type="checkbox" checked={slow} onChange={(event) => setSlow(event.target.checked)} />慢速朗读</label>
        </div>
      </div>
      <p className="english-results" role="status">共 {filteredWords.length} 个词 · 单词和例句均可点击喇叭朗读</p>
      {!speechSupported && <p className="manual-access-hint">此浏览器不支持语音朗读，请使用支持语音合成的浏览器。你仍可查看音标和翻译。</p>}
      {message && <p className="manual-access-hint" role="status">{message}</p>}
      <div className="english-grid">
        {filteredWords.map((word) => {
          const visible = showTranslation || revealed.includes(word.id)
          const known = mastered.includes(word.id)
          return <article className={`english-card${known ? ' is-mastered' : ''}`} key={word.id}>
            <div className="english-card-top"><span>{CATEGORY_NAMES[word.category] || word.category}</span><span>#{String(word.id).padStart(3, '0')}</span></div>
            <div className="english-word"><h2 lang="en">{word.word}</h2><button className={`english-audio${speaking === `word-${word.id}` ? ' is-speaking' : ''}`} disabled={!speechSupported} onClick={() => speak(word.word, `word-${word.id}`)} aria-label={`朗读单词 ${word.word}`}><Volume2 size={20} /></button></div>
            <p className="english-ipa">{word.ipa}</p>
            {visible ? <p className="english-meaning">{word.meaning}</p> : <button className="english-reveal" onClick={() => setRevealed((values) => [...values, word.id])}>想好了吗？点击查看翻译</button>}
            <details className="english-example" open><summary>例句与朗读</summary><div><span lang="en">{word.example}</span><button className={`english-audio${speaking === `example-${word.id}` ? ' is-speaking' : ''}`} disabled={!speechSupported} onClick={() => speak(word.example, `example-${word.id}`)} aria-label={`朗读例句 ${word.example}`}><Volume2 size={16} /></button></div>{visible && <p>{word.translation}</p>}</details>
            <button className="english-master" aria-pressed={known} onClick={() => toggleMastered(word.id)}><Check size={15} />{known ? '已掌握 · 点击取消' : '标记为已掌握'}</button>
          </article>
        })}
      </div>
      {!filteredWords.length && <div className="english-empty"><h2>{onlyNew && !query && category === 'all' ? '全部掌握，做得不错！' : '没有符合条件的单词'}</h2><p>可以切换分类、修改搜索词，或关闭“只看未掌握”继续复习。</p><button className="button button-outline" onClick={() => { setQuery(''); setCategory('all'); setOnlyNew(false) }}>查看全部单词</button></div>}
    </section>
  )
}
