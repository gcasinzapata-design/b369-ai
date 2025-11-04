'use client'

import { useState } from 'react'

type Role = 'user' | 'assistant'
type Message = { role: Role; content: string }

export default function ChatAgent({ context = '' }: { context?: string }) {
  const [msgs, setMsgs] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hola, soy tu agente IA inmobiliario. Pregúntame por zonas, precios m², tendencias y comparables. 🙂',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input }
    const nextMsgs: Message[] = [...msgs, userMsg]

    // Optimistic UI
    setMsgs(nextMsgs)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMsgs, context }),
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`API /api/agent ${res.status} – ${txt}`)
      }

      const data = (await res.json()) as { ok: boolean; reply?: string }
      if (!data.ok || !data.reply) throw new Error('Sin respuesta de IA')

      const assistantMsg: Message = { role: 'assistant', content: data.reply }
      setMsgs((prev) => [...prev, assistantMsg])
    } catch (e: any) {
      setMsgs((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ No pude responder ahora mismo. Intenta de nuevo o ajusta tu consulta.',
        },
      ])
      // (opcional) console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="card p-3 h-[520px] flex flex-col">
      <div className="font-semibold mb-2">Agente IA experto inmobiliario</div>
      <div className="flex-1 overflow-auto space-y-2 border rounded-lg p-2 bg-gray-50">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'text-right'
                : 'text-left'
            }
          >
            <div
              className={
                'inline-block rounded-lg px-3 py-2 text-sm ' +
                (m.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-white border')
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <textarea
          className="input min-h-[44px] resize-none"
          placeholder="Ej: ¿Precio m² en Miraflores para 2D/2B desde 70 m²?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          className="btn btn-primary whitespace-nowrap"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Pensando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
