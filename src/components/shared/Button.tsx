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
            className={`px-4 py-2 rounded focus:outline-none transition-colors ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
