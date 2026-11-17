/**
 * Design tokens Colombocal.
 *
 * Estratégia: as telas usam utilitários `gray-*`, `slate-*` e `blue-*` em centenas de lugares.
 * Em vez de reescrever cada arquivo, os tokens são redefinidos aqui:
 * - `gray` e `slate` apontam para a mesma escala neutra (acaba a mistura de dois cinzas);
 * - `blue` / `primary` / `brand` apontam para a escala derivada do navy da marca (#004071).
 * Assim a identidade é aplicada de forma consistente e cores semânticas
 * (green/amber/red/orange) continuam com significado de status.
 */

/** Neutro levemente frio — leitura prolongada sem cansar. */
const neutral = {
  50: '#f7f8fa',
  100: '#eff1f4',
  200: '#e3e6eb',
  300: '#cfd4dc',
  400: '#9aa3b1',
  500: '#6a7383',
  600: '#4e5665',
  700: '#3a414d',
  800: '#252a33',
  900: '#161a21',
  950: '#0c0f14',
};

/** Azul institucional derivado do navy Colombocal (800 = #004071). */
const brand = {
  50: '#eef5fc',
  100: '#d9e8f7',
  200: '#b6d2ee',
  300: '#86b3e0',
  400: '#4f8dcc',
  500: '#2a6fb5',
  600: '#13599c',
  700: '#0b4a85',
  800: '#004071',
  900: '#062f53',
  950: '#041f38',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: neutral,
        slate: neutral,
        blue: brand,
        primary: brand,
        brand: {
          ...brand,
          red: '#C1272D',
          gold: '#E8B84A',
          sky: '#CDEBFA',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        // Sombras discretas: separação por borda, não por "flutuação".
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.04)',
        md: '0 4px 8px -2px rgb(16 24 40 / 0.06), 0 2px 4px -2px rgb(16 24 40 / 0.04)',
        lg: '0 12px 24px -6px rgb(16 24 40 / 0.10), 0 4px 8px -4px rgb(16 24 40 / 0.04)',
        xl: '0 20px 40px -12px rgb(16 24 40 / 0.18)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'pop-in': 'pop-in 140ms ease-out',
      },
    },
  },
  plugins: [],
};
