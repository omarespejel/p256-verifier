import type { ReactNode } from 'react'

interface InfoCardProps {
  title: string
  children: ReactNode
  variant?: 'info' | 'success' | 'warning'
}

export function InfoCard({
  title,
  children,
  variant = 'info'
}: InfoCardProps) {
  return (
    <div className={`info-card ${variant}`}>
      <h4>{title}</h4>
      <div className="info-content">{children}</div>
    </div>
  )
}


