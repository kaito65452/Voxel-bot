export default {
    name: 'birthday',
    aliases: ['ultah'],

    async execute({ m, voxel }) {
        const content = [
            '🎂 *SELAMAT ULANG TAHUN!* 🎉',
            '',
            '✨ Semoga hari spesialmu dipenuhi kebahagiaan, kesehatan, dan hal-hal menyenangkan!',
            '',
            '🎁 **Birthday Wishes**',
            '',
            '| 🎁 | Wish |',
            '|---|---|',
            '| 🎂 | Happy Birthday! |',
            '| ❤️ | Semoga selalu bahagia |',
            '| ✨ | Semoga semua impian tercapai |',
            '| 🎉 | Semoga harimu menyenangkan! |',
            '',
            '```javascript',
            'function birthday(name) {',
            '    return `🎂 Happy Birthday, ${name}! 🎉`',
            '}',
            '```',
            '',
            '🌐 **HTML Version**',
            '',
            '```html',
            '<div class="birthday-card">',
            '    <h1>🎂 Happy Birthday!</h1>',
            '    <p>Semoga semua impianmu tercapai ✨</p>',
            '</div>',
            '```',
            '',
            '🎨 **CSS Version**',
            '',
            '```css',
            '.birthday-card {',
            '    padding: 20px;',
            '    border-radius: 16px;',
            '    text-align: center;',
            '}',
            '```',
            '',
            '🎉 *Have a wonderful day!* 🎉'
        ].join('\n')

        await voxel.sendMessage(
            m.chat,
            {
                text: content,
                rich: true,
                title: '🎂 Birthday Card'
            },
            {
                quoted: m
            }
        )
    }
}
