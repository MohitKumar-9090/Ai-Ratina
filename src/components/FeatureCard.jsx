import { motion } from 'framer-motion'

export default function FeatureCard({ icon: Icon, title, description }) {
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className="bento-card"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-soft text-primary-deep">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
    </motion.article>
  )
}
