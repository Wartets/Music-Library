import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'subtle';
    // TODO: Add sizes and icon props
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', children, ...props }) => {
    // TODO: Render UI atom with Chameleon UI colors logic wrapper
    // Integrate Tailwind classes dynamically based on variant
    return (
        <button
            className={`px-4 py-2 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dominant focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
