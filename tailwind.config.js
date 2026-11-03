module.exports = {
  content: ['./index.html', './app.js', './js/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Open Sans"', 'sans-serif'], display: ['"Barlow Condensed"', '"Open Sans"', 'sans-serif'] },
      colors: {
        argon: {
          primary: '#ff4b44', secondary: '#232330', success: '#2dce89', info: '#11cdef',
          warning: '#ffb020', danger: '#ff5a67', dark: '#f2f2f7', muted: '#9a9ab0',
          light: '#34344a', bg: '#0d0d14'
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
