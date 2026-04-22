import React from 'react';
import { Link } from 'react-router-dom';
import SafeIcon from './SafeIcon';

const Button = ({
  children,
  to,
  onClick,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'pill'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon,
  iconPosition = 'right', // 'left' | 'right'
  className = '',
  type = 'button',
  fullWidth = false,
  ...props
}) => {
  // Base styles shared across all buttons
  const baseStyles = "inline-flex items-center justify-center gap-2.5 font-medium transition-all duration-300 group text-center";

  // Branding specific variants
  const variants = {
    primary: "bg-[#1a1a1a] text-white hover:bg-black rounded-[4px]",
    secondary: "bg-[#f4f4f4] text-[#1a1a1a] hover:bg-[#e5e5e5] rounded-[4px]",
    outline: "bg-transparent border border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white rounded-[4px]",
    pill: "bg-white border border-[#e5e5e5] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white hover:border-[#1a1a1a] rounded-full shadow-sm"
  };

  // Size configurations
  const sizes = {
    sm: "px-6 py-3 text-sm",
    md: "px-8 py-4 text-base",
    lg: "px-10 py-5 text-lg"
  };

  // Combine all classes
  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : 'w-fit'} ${className}`;

  // Render Icon if provided with smooth translate animation based on position
  const IconElement = icon && (
    <SafeIcon 
      icon={icon} 
      className={`text-lg transition-transform duration-300 ${
        iconPosition === 'right' 
          ? 'group-hover:translate-x-1.5' 
          : 'group-hover:-translate-x-1.5'
      }`} 
    />
  );

  // Inner content layout
  const content = (
    <>
      {iconPosition === 'left' && IconElement}
      <span>{children}</span>
      {iconPosition === 'right' && IconElement}
    </>
  );

  // If a 'to' prop is provided, render as a React Router Link
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  // Otherwise, render as a standard HTML button
  return (
    <button type={type} onClick={onClick} className={classes} {...props}>
      {content}
    </button>
  );
};

export default Button;