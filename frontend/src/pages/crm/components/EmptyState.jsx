import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="p-4 rounded-2xl bg-slate-50 mb-4">
      <Icon className="w-10 h-10 text-slate-300" />
    </div>
    <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
    <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
    {action}
  </div>
);
