import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        manrope: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Custom color palette
        primary: {
          red: '#E53935',      // Dynamic, energetic accent
          'red-dark': '#C62828', // For hover states or emphasis
        },
        charcoal: '#212121',    // UI base color
        'light-gray': '#F5F5F5', // Background / contrast
        'accent-blue': '#2979FF', // For links or notifications
        // Additional shades for consistency
        'primary-red-light': '#FFEBEE', // Very light red for backgrounds
        'primary-red-lighter': '#FFCDD2', // Light red for subtle backgrounds
      },
    },
  },
  plugins: [],
};

export default config;