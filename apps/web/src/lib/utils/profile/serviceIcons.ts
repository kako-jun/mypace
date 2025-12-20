// Get icon name for service (lucide-react icons)
export function getWebsiteIcon(label: string): string {
  switch (label) {
    // Social / SNS
    case 'GitHub':
      return 'Github'
    case 'GitLab':
      return 'Gitlab'
    case 'X':
      return 'Twitter' // lucide-react icon name
    case 'YouTube':
      return 'Youtube'
    case 'Instagram':
      return 'Instagram'
    case 'LinkedIn':
      return 'Linkedin'
    case 'Facebook':
      return 'Facebook'
    case 'Twitch':
      return 'Twitch'
    case 'Discord':
      return 'MessageCircle'
    case 'Slack':
      return 'Slack'
    case 'Figma':
      return 'Figma'
    case 'Dribbble':
      return 'Dribbble'
    case 'CodePen':
      return 'Codepen'
    case 'Pinterest':
      return 'Pin'
    case 'Chrome Web Store':
      return 'Chrome'

    // Messaging
    case 'Telegram':
      return 'Send'
    case 'WhatsApp':
    case 'LINE':
    case 'Signal':
      return 'MessageCircle'
    case 'Reddit':
      return 'MessageSquare'

    // Music / Audio
    case 'Spotify':
    case 'Apple Music':
    case 'SoundCloud':
    case 'Bandcamp':
      return 'Music'

    // Video
    case 'Vimeo':
    case 'Dailymotion':
    case 'TikTok':
    case 'ニコニコ':
    case 'bilibili':
    case 'SHOWROOM':
    case '17LIVE':
    case 'Pococha':
      return 'Video'

    // Blog / Writing
    case 'Medium':
    case 'Substack':
    case 'DEV':
    case 'Hashnode':
    case 'Qiita':
    case 'Zenn':
    case 'note':
    case 'はてなブログ':
    case 'はてな':
    case 'Ameba':
    case 'FC2':
    case 'livedoor':
    case 'ココログ':
    case 'Tumblr':
      return 'FileText'

    // Bookmarks
    case 'はてブ':
      return 'Bookmark'

    // Art / Design
    case 'Behance':
    case 'Pixiv':
    case 'FANBOX':
      return 'Palette'

    // Shopping / Commerce
    case 'Amazon':
    case 'Etsy':
    case 'BOOTH':
    case 'SUZURI':
    case 'minne':
    case 'Creema':
    case 'STORES':
    case 'BASE':
    case 'Gumroad':
    case 'メルカリ':
    case '楽天':
      return 'ShoppingBag'

    // Donation / Support
    case 'Patreon':
    case 'Ko-fi':
    case 'Buy Me a Coffee':
      return 'Heart'

    // Payment
    case 'PayPal':
      return 'CreditCard'

    // Gaming
    case 'Steam':
    case 'itch.io':
    case 'FF14':
    case 'PlayStation':
    case 'Xbox':
    case 'Nintendo':
      return 'Gamepad2'

    // Events
    case 'connpass':
    case 'Doorkeeper':
      return 'Calendar'

    // Careers
    case 'Wantedly':
      return 'Briefcase'

    // Presentations
    case 'Speaker Deck':
    case 'SlideShare':
      return 'Presentation'

    // Link aggregators
    case 'lit.link':
    case 'Linktree':
    case 'POTOFU':
      return 'Link'

    // Productivity
    case 'Notion':
      return 'BookOpen'

    // Misc
    case 'Stack Overflow':
      return 'HelpCircle'
    case 'Product Hunt':
      return 'Rocket'
    case 'Goodreads':
    case 'Letterboxd':
      return 'BookOpen'
    case 'OpenSea':
      return 'Gem'
    case 'Mastodon':
    case 'Bluesky':
    case 'Threads':
      return 'AtSign'
    case 'Bitbucket':
      return 'GitBranch'
    case 'Yahoo! JAPAN':
      return 'Search'
    case 'mixi':
    case 'mixi2':
    case 'Snapchat':
    case 'WeChat':
      return 'Users'

    default:
      return 'Globe'
  }
}
