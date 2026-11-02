module.exports = {
  content: ['./index.html', './app.js', './js/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Open Sans"', 'sans-serif'] },
      colors: {
        argon: {
          primary: '#5e72e4', secondary: '#f4f5f7', success: '#2dce89', info: '#11cdef',
          warning: '#fb6340', danger: '#f5365c', dark: '#172b4d', muted: '#8898aa',
          light: '#ced4da', bg: '#f8f9fe'
        }
      },
      boxShadow: {
        'argon': '0 15px 35px rgba(50, 50, 93, 0.1), 0 5px 15px rgba(0, 0, 0, 0.07)',
        'argon-sm': '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)',
        'argon-card': '0 0 2rem 0 rgba(136, 152, 170, .15)',
        'argon-nav': '0 -4px 18px rgba(0, 0, 0, 0.06)'
      }
    }
  }
};
