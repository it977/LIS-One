/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-dark': '#1E293B',
        'primary-med': '#2563EB',
        'primary-light': '#EFF6FF',
        'accent': '#38BDF8',
      },
      fontFamily: {
        'lao': ['Noto Sans Lao', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  // ອະນຸຍາດໃຫ້ໃຊ້ class ຮ່ວມກັບ Bootstrap
  corePlugins: {
    preflight: false,
  }
}
