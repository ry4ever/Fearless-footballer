import { MessageSquare, Sparkles, TrendingUp, Users } from "lucide-react";

const feedArticles = [
  {
    id: "1",
    author: "Alex Rivera",
    role: "Football Mentor",
    timeAgo: "2h ago",
    title: "Why adrenaline before kickoff is your greatest advantage",
    preview: "Young players often misinterpret an elevated heartbeat as fear. Here is how top professionals channel that nervous surge into heightened reaction speed.",
    category: "Matchday Psychology",
  },
  {
    id: "2",
    author: "Dr. Elena Rostova",
    role: "Youth Sports Neurologist",
    timeAgo: "Yesterday",
    title: "The 4-second box breathing cadence for penalty kicks",
    preview: "Vagus nerve stimulation reduces muscle tremor and steadies foot alignment under high-stakes dead ball situations.",
    category: "Somatic Training",
  },
];

export function FeedScreen() {
  return (
    <div className="screen feed-screen">
      <header className="feed-header">
        <div>
          <span className="eyebrow">COMMUNITY & INSIGHTS</span>
          <h1>Mentor Feed</h1>
        </div>
        <div className="feed-badge">
          <Sparkles size={16} />
        </div>
      </header>

      <main className="feed-list">
        {feedArticles.map((item) => (
          <article key={item.id} className="feed-article-card">
            <div className="article-header">
              <div className="author-avatar">{item.author.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{item.author}</strong>
                <span className="author-role">{item.role} • {item.timeAgo}</span>
              </div>
            </div>

            <span className="article-category">{item.category}</span>
            <h3>{item.title}</h3>
            <p>{item.preview}</p>

            <div className="article-footer">
              <button type="button" className="read-more-btn">
                Read Full Insight
              </button>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
