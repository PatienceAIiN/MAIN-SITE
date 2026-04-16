import { motion } from 'framer-motion';

const directionMap = {
  up:    { y: 28, x: 0 },
  down:  { y: -28, x: 0 },
  left:  { x: 28, y: 0 },
  right: { x: -28, y: 0 },
  none:  { x: 0, y: 0 },
};

const FadeIn = ({ children, delay = 0, direction = 'up', duration = 0.5, className = '', as = 'div' }) => {
  const { x, y } = directionMap[direction] || directionMap.up;
  const Tag = motion[as] || motion.div;

  return (
    <Tag
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </Tag>
  );
};

export default FadeIn;
