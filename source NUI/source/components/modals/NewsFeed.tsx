import { createSignal, createMemo, For, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import {
  newsState,
  newsActions,
  type NewsArticle,
  type NewsCategory,
} from '~/stores/newsStore';
import { Button, Modal } from '~/components/ui';

export function NewsFeed() {
  const [categoryFilter, setCategoryFilter] = createSignal<NewsCategory | 'ALL'>('ALL');
  const [expandedArticle, setExpandedArticle] = createSignal<string | null>(null);

  const publishedArticles = createMemo(() => {
    const articles = Object.values(newsState.articles)
      .filter(a => a.status === 'PUBLISHED')
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime();
      });

    const filter = categoryFilter();
    if (filter === 'ALL') return articles;
    return articles.filter(a => a.category === filter);
  });

  const categories: Array<{ value: NewsCategory | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'ALL' },
    { value: 'BREAKING', label: 'BREAKING' },
    { value: 'POLICE', label: 'POLICE' },
    { value: 'EMS', label: 'EMS' },
    { value: 'COMMUNITY', label: 'COMMUNITY' },
    { value: 'TRAFFIC', label: 'TRAFFIC' },
    { value: 'WEATHER', label: 'WEATHER' },
    { value: 'OFFICIAL', label: 'OFFICIAL' },
  ];

  const getCategoryColor = (cat: NewsCategory) => {
    const colors: Record<NewsCategory, string> = {
      BREAKING: '#ff0000',
      POLICE: '#4488ff',
      EMS: '#ff8800',
      COMMUNITY: '#00cc88',
      TRAFFIC: '#ffcc00',
      WEATHER: '#88bbff',
      OFFICIAL: '#cc88ff',
    };
    return colors[cat] || '#808080';
  };

  const normalizeMediaUrl = (raw: string) => {
    const value = raw.trim();
    if (value === '') return '';
    if (value.startsWith('//')) return `https:${value}`;
    if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    return `https://${value}`;
  };

  const toggleArticle = (articleId: string) => {
    if (expandedArticle() === articleId) {
      setExpandedArticle(null);
    } else {
      setExpandedArticle(articleId);
      newsActions.incrementViews(articleId);
    }
  };

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  return (
    <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content news-manager" onClick={e => e.stopPropagation()}>
        <Modal.Header>
          <Modal.Title>=== NEWS FEED ===</Modal.Title>
          <Modal.Close />
        </Modal.Header>

        <div style={{ display: 'flex', gap: '4px', padding: '8px 10px', 'flex-wrap': 'wrap' }}>
          <For each={categories}>
            {(cat) => (
              <button
                style={{
                  padding: '3px 8px',
                  border: `1px solid ${categoryFilter() === cat.value ? '#00ff00' : '#3a3a3a'}`,
                  background: categoryFilter() === cat.value ? '#1a3a1a' : 'transparent',
                  color: categoryFilter() === cat.value ? '#00ff00' : '#c0c0c0',
                  cursor: 'pointer',
                  'font-size': '11px',
                }}
                onClick={() => setCategoryFilter(cat.value)}
              >
                {cat.label}
              </button>
            )}
          </For>
        </div>

        <div class="modal-body" style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}>
          <Show when={publishedArticles().length === 0}>
            <div class="empty-state">No published news articles</div>
          </Show>

          <For each={publishedArticles()}>
            {(article) => (
              <div
                style={{
                  padding: '10px',
                  'border-bottom': '1px solid #2a2a2a',
                  cursor: 'pointer',
                }}
                onClick={() => toggleArticle(article.articleId)}
              >
                <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '4px' }}>
                  <span style={{
                    padding: '1px 6px',
                    border: `1px solid ${getCategoryColor(article.category)}`,
                    color: getCategoryColor(article.category),
                    'font-size': '10px',
                  }}>
                    {article.category}
                  </span>
                  <span style={{ color: '#808080', 'font-size': '11px' }}>
                    {new Date(article.publishedAt || article.createdAt).toLocaleString()}
                  </span>
                  {article.isPinned && <span style={{ color: '#ffcc00', 'font-size': '10px' }}>PINNED</span>}
                </div>

                <h4 style={{ margin: '4px 0', color: '#e0e0e0' }}>{article.headline}</h4>

                <Show when={expandedArticle() !== article.articleId}>
                  <p style={{ color: '#a0a0a0', 'font-size': '12px', margin: '4px 0' }}>
                    {article.lead.substring(0, 200)}{article.lead.length > 200 ? '...' : ''}
                  </p>
                </Show>

                <Show when={expandedArticle() === article.articleId}>
                  <Show when={article.featuredImage?.url}>
                    <div style={{ margin: '8px 0' }}>
                      <img
                        src={normalizeMediaUrl(article.featuredImage!.url)}
                        alt={article.headline}
                        style={{ 'max-width': '100%', 'max-height': '200px', 'object-fit': 'cover' }}
                      />
                    </div>
                  </Show>

                  <p style={{ color: '#c0c0c0', 'font-size': '12px', margin: '8px 0', 'white-space': 'pre-wrap' }}>
                    {article.lead}
                  </p>

                  <div style={{ color: '#808080', 'font-size': '11px', 'margin-top': '8px' }}>
                    By: {article.author.name}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>{publishedArticles().length} article(s)</span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
