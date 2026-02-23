import React, { InputHTMLAttributes } from 'react';

export const Input: React.FC<InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
    // TODO: Render styled input UI atom (used for search bar, inline editing)
    return (
        <input
            className={`bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded px-3 py-2 outline-none focus:border-blue-500 transition-colors ${className}`}
            {...props}
        />
    );
};
