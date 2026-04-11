import React from 'react';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import ContentLink from './ContentLink';

const Footer = ({ brand, content, onAction }) => {
  return (
    <footer className="bg-white border-t border-slate-100 pt-12 pb-6">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-2">
              <span className="site-brand site-brand--dark">{brand.name}</span>
            </div>
            <p className="max-w-xs text-sm leading-6 text-slate-500 mb-0">{content.description}</p>
          </div>

          {content.columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-bold text-slate-900 mb-4">{column.title}</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <ContentLink
                      item={link}
                      onAction={onAction}
                      className="hover:text-indigo-600 transition-colors"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">{content.copyright}</p>
          <div className="flex gap-4">
            {content.socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                aria-label={link.label}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors"
              >
                <SafeIcon icon={iconRegistry[link.icon]} className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
