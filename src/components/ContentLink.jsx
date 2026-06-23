import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const buildTo = (action) => {
  if (!action) {
    return '#';
  }

  if (action.type === 'route') {
    return action.to;
  }

  if (action.type === 'routeHash') {
    return `${action.to}#${action.hash}`;
  }

  return action.href || '#';
};

const ContentLink = ({
  item,
  onAction,
  className = '',
  activeClassName = '',
  inactiveClassName = '',
  children
}) => {
  const location = useLocation();
  const action = item.action;
  const label = children ?? item.label;
  const isActive = item.activePath ? location.pathname === item.activePath : false;
  const stateClass = isActive ? activeClassName : inactiveClassName;

  if (action?.type === 'modal') {
    return (
      <button
        type="button"
        onClick={() => onAction?.(action)}
        className={`${className} ${stateClass}`.trim()}
      >
        {label}
      </button>
    );
  }

  const externalHref =
    action?.type === 'external'
      ? action.href
      : (action?.href && /^https?:\/\//.test(action.href) ? action.href : null);

  if (externalHref) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noreferrer"
        className={`${className} ${stateClass}`.trim()}
      >
        {label}
      </a>
    );
  }

  return (
    <Link to={buildTo(action)} className={`${className} ${stateClass}`.trim()}>
      {label}
    </Link>
  );
};

export default ContentLink;
