export const metadata = {
  title: '题库网站',
  description: '一个集题库管理、AI辅助解析和模拟训练于一体的在线学习平台',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
} 