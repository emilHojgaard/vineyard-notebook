import { useState, useEffect, useRef, useId } from 'react';
import { useData } from '../../contexts/DataContext';
import { Icon } from '../../components/Icon';
import { useModalKeyboard } from '../../components/useModalKeyboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface CalendarSubscriptionModalProps {
  onClose: () => void;
  seasonYear: number;
}

export function CalendarSubscriptionModal({ onClose, seasonYear }: CalendarSubscriptionModalProps) {
  const { currentProject, generateCalendarToken, listCalendarTokens, revokeCalendarToken } = useData();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [existingTokens, setExistingTokens] = useState<Array<{ id: string; createdAt: string | null }>>([]);
  const [tokenToRevoke, setTokenToRevoke] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const keyboard = useModalKeyboard(true, onClose, modalRef);

  // Get the function URL based on environment
  const getFunctionUrl = () => {
    // In production, this should be your deployed function URL
    // You'll need to update this after deploying
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    return `https://us-central1-${projectId}.cloudfunctions.net/calendarFeed`;
  };

  useEffect(() => {
    loadExistingTokens();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const loadExistingTokens = async () => {
    try {
      const tokens = await listCalendarTokens();
      setExistingTokens(tokens);
    } catch (err) {
      console.error('Error loading tokens:', err);
    }
  };

  const handleGenerateToken = async () => {
    if (!currentProject) return;
    
    setLoading(true);
    setError(null);
    try {
      const newToken = await generateCalendarToken();
      setToken(newToken);
      await loadExistingTokens();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    setLoading(true);
    setError(null);
    try {
      await revokeCalendarToken(tokenId);
      await loadExistingTokens();
      if (token === tokenId) {
        setToken(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionUrl = () => {
    if (!token || !currentProject) return '';
    return `${getFunctionUrl()}/${currentProject.id}/${seasonYear}?token=${token}`;
  };

  const handleCopyUrl = () => {
    const url = getSubscriptionUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyboard.onKeyDown} className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-bold text-ink">Calendar Subscription</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded-md text-ink hover:bg-surface-2 transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Introduction */}
          <div className="space-y-2">
            <h3 className="font-semibold text-ink">Live Calendar Subscription</h3>
            <p className="text-sm text-ink-soft">
              Subscribe to your vineyard calendar and automatically sync events to Google Calendar, Outlook, Apple Calendar, or any calendar app that supports .ics subscriptions.
            </p>
            <p className="text-sm text-ink-soft">
              When you add or change events in Vineyard Notebook, they'll automatically appear in your subscribed calendar (calendar apps typically refresh every few hours).
            </p>
          </div>

          {/* Generate Token Section */}
          {!token && existingTokens.length === 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGenerateToken}
                disabled={loading}
                className="w-full px-4 py-3 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon name="link" size={16} />
                    Generate Subscription Link
                  </>
                )}
              </button>
            </div>
          )}

          {/* Subscription URL */}
          {token && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="subscription-url" className="text-sm font-semibold text-ink">Subscription URL</label>
                <div className="flex gap-2">
                  <input
                    id="subscription-url"
                    type="text"
                    value={getSubscriptionUrl()}
                    readOnly
                    className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-surface font-mono"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-4 py-2 bg-surface border border-border rounded-md text-ink hover:bg-surface-2 transition-colors flex items-center gap-2"
                  >
                    <Icon name={copied ? 'check' : 'copy'} size={16} />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-900">
                <strong>Keep this URL private!</strong> Anyone with this link can view your calendar events. You can revoke it at any time below.
              </div>
            </div>
          )}

          {/* Instructions */}
          {(token || existingTokens.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink">How to Subscribe</h3>
              
              <div className="space-y-4">
                {/* Google Calendar */}
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-ink">Google Calendar</div>
                  <ol className="text-sm text-ink-soft space-y-1 list-decimal list-inside">
                    <li>Open Google Calendar on your computer</li>
                    <li>On the left, click the <strong>+</strong> next to "Other calendars"</li>
                    <li>Click <strong>From URL</strong></li>
                    <li>Paste the subscription URL and click <strong>Add calendar</strong></li>
                  </ol>
                </div>

                {/* Apple Calendar */}
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-ink">Apple Calendar (Mac/iPhone)</div>
                  <ol className="text-sm text-ink-soft space-y-1 list-decimal list-inside">
                    <li>Open Calendar app</li>
                    <li>Go to <strong>File → New Calendar Subscription</strong></li>
                    <li>Paste the subscription URL and click <strong>Subscribe</strong></li>
                  </ol>
                </div>

                {/* Outlook */}
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-ink">Outlook</div>
                  <ol className="text-sm text-ink-soft space-y-1 list-decimal list-inside">
                    <li>Open Outlook Calendar</li>
                    <li>Go to <strong>Add calendar → Subscribe from web</strong></li>
                    <li>Paste the subscription URL and click <strong>Import</strong></li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Existing Tokens */}
          {existingTokens.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink">Active Tokens</h3>
              <div className="space-y-2">
                {existingTokens.map((existingToken) => (
                  <div
                    key={existingToken.id}
                    className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-md"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-ink-soft truncate">
                        {existingToken.id}
                      </div>
                      {existingToken.createdAt && (
                        <div className="text-xs text-ink-faint mt-1">
                          Created: {new Date(existingToken.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTokenToRevoke(existingToken.id)}
                      disabled={loading}
                      className="ml-3 px-3 py-1.5 border border-red-200 text-red-600 rounded-md text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
              {!token && (
                <button
                  type="button"
                  onClick={handleGenerateToken}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-dashed border-border rounded-lg text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="add" size={16} />
                  Generate New Token
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-ink font-semibold hover:bg-surface-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={tokenToRevoke !== null}
        title="Revoke subscription token"
        message="Calendar subscriptions using this token will stop working. This cannot be undone."
        confirmText="Revoke"
        onConfirm={() => {
          if (tokenToRevoke) void handleRevokeToken(tokenToRevoke);
          setTokenToRevoke(null);
        }}
        onCancel={() => setTokenToRevoke(null)}
        isDanger
      />
    </div>
  );
}
