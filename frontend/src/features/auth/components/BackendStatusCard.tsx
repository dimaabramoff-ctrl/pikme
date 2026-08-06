import { useEffect, useState } from 'react'

interface BackendStatusCardProps {
  className?: string
}

export function BackendStatusCard({ className = '' }: BackendStatusCardProps) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    let cancelled = false

    const probe = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!cancelled) {
          setStatus(response.ok ? 'online' : 'offline')
        }
      } catch {
        if (!cancelled) {
          setStatus('offline')
        }
      }
    }

    void probe()
    return () => {
      cancelled = true
    }
  }, [])

  const label = status === 'checking'
    ? 'Serververfügbarkeit wird geprüft…'
    : status === 'online'
      ? 'Backend erreichbar'
      : 'Backend nicht erreichbar. Verbindung prüfen.'

  const tone = status === 'online'
    ? 'border-[#cfe6d8] bg-[#f3fbf6] text-[#2f6a44]'
    : status === 'offline'
      ? 'border-[#f0cfcf] bg-[#fef4f4] text-[#a54343]'
      : 'border-[#dfe8ea] bg-[#f8fbfc] text-[#5d7074]'

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${tone} ${className}`.trim()}>
      {label}
    </div>
  )
}
