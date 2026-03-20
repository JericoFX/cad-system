import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'CAD System',
  description: 'Computer Aided Dispatch Terminal — FiveM Resource Documentation',
  lang: 'en-US',
  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#00ff41' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'CAD System',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/overview' },
      { text: 'API', link: '/api/exports' },
      { text: 'Config', link: '/guide/configuration' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Profiles', link: '/guide/profiles' },
          ],
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/guide/architecture' },
            { text: 'NUI (Frontend)', link: '/guide/nui' },
            { text: 'Server & Database', link: '/guide/server' },
            { text: 'Security', link: '/guide/security' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Modules',
          items: [
            { text: 'Feature Overview', link: '/features/overview' },
            { text: 'Cases', link: '/features/cases' },
            { text: 'Dispatch', link: '/features/dispatch' },
            { text: 'Evidence & Forensics', link: '/features/evidence' },
            { text: 'EMS', link: '/features/ems' },
            { text: 'Police Operations', link: '/features/police' },
            { text: 'Security Cameras', link: '/features/cameras' },
            { text: 'News System', link: '/features/news' },
            { text: 'Photo System', link: '/features/photos' },
            { text: 'Vehicle Tablet', link: '/features/vehicle-tablet' },
            { text: 'Radio & Map', link: '/features/radio-map' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Developer API',
          items: [
            { text: 'Exports Reference', link: '/api/exports' },
            { text: 'Events', link: '/api/events' },
            { text: 'NUI Messages', link: '/api/nui-messages' },
            { text: 'Addons', link: '/api/addons' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/JericoFX/cad-system' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'CAD System by JericoFX',
      copyright: 'Built for FiveM with QBCore + ox_lib',
    },
  },
})
