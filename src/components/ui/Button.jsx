import React from 'react';
import { motion } from 'framer-motion';

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyles = "inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 focus:ring-indigo-500",
    secondary: "bg-white text-slate-900 shadow-sm border border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-500",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-slate-500",
    white: "bg-white text-slate-900 shadow-lg border border-slate-200 hover:shadow-xl hover:border-slate-300 hover:-translate-y-0.5 focus:ring-slate-500",
    whiteOutline: "border border-slate-300 bg-white/80 text-slate-900 shadow-lg shadow-black/5 hover:bg-white hover:border-slate-400 hover:-translate-y-0.5 focus:ring-slate-500 backdrop-blur-sm",
    coral: "bg-[#EF6A6A] text-white hover:bg-[#e05a5a] shadow-lg shadow-[#EF6A6A]/20 hover:shadow-[#EF6A6A]/40 hover:-translate-y-0.5 focus:ring-[#EF6A6A]",
    purple: "bg-[#6D72D6] text-white hover:bg-[#5c61bf] shadow-lg shadow-[#6D72D6]/20 hover:shadow-[#6D72D6]/40 hover:-translate-y-0.5 focus:ring-[#6D72D6]"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default Button;
