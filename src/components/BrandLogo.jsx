import React from 'react';

const BrandLogo = ({ brand, tone = 'light', compact = false }) => {
  const isLight = tone === 'light';

  return (
    <div className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${isLight ? 'brand-logo--light' : 'brand-logo--dark'}`}>
      <span className="brand-logo__mark" aria-hidden="true">
        <span className="brand-logo__mark-text">PA</span>
      </span>
      <span className="brand-logo__wordmark">{brand.name}</span>
    </div>
  );
};

export default BrandLogo;
