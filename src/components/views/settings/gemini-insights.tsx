'use client';

import { Check, X, AlertTriangle, Sparkles, GraduationCap, Briefcase, Lock, ShieldAlert, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import styles from './settings-view.module.css';

/**
 * Educational panel for the Google AI Studio (Gemini API key) section.
 * Highlights the pros/cons and privacy trade-offs of using an AI Studio key,
 * plus a Free vs Paid tier comparison — mirroring the Vertex "local sovereignty"
 * benefit card presented on the other tab.
 */
export function GeminiInsights() {
  return (
    <div className={styles.insightWrap}>
      <div className={`${styles.insightCard} ${styles.insightCardBlue}`}>
        <div className={styles.insightHeader}>
          <div className={styles.insightTitle}>
            <ShieldAlert className={`${styles.insightIcon} ${styles.insightIconBlue}`} />
            <span>What to know before using an AI Studio key</span>
          </div>
          <Badge variant="outline" className={`${styles.insightBadge} ${styles.insightBadgeBlue}`}>
            Read first
          </Badge>
        </div>
        <div className={styles.insightList}>
          <div className={styles.insightItem}>
            <Lock className={styles.insightWarn} />
            <span>
              <strong>Data leaves your machine.</strong> Unlike the Vertex tab, audio is sent to Google&apos;s
              API for transcription and is stored &amp; processed on Google&apos;s servers.
            </span>
          </div>
          <div className={styles.insightItem}>
            <ShieldAlert className={styles.insightWarn} />
            <span>
              <strong>Your files, transcripts &amp; DB stay local.</strong> autoScriber never uploads your
              recordings to a server of ours — only the selected files you transcribe reach the Gemini API.
            </span>
          </div>
          <div className={styles.insightItem}>
            <AlertTriangle className={styles.insightWarn} />
            <span>
              <strong>Never publish or share your key.</strong> Anyone with it can use your quota and may incur
              charges. Only use keys you control.
            </span>
          </div>
        </div>
      </div>

      <div className={`${styles.insightCard} ${styles.insightCardAmber}`}>
        <div className={styles.insightHeader}>
          <div className={styles.insightTitle}>
            <Zap className={`${styles.insightIcon} ${styles.insightIconAmber}`} />
            <span>Pros &amp; Cons of AI Studio keys</span>
          </div>
          <Badge variant="outline" className={`${styles.insightBadge} ${styles.insightBadgeAmber}`}>
            Honest take
          </Badge>
        </div>
        <div className={styles.insightList}>
          <div className={styles.insightItem}>
            <Check className={styles.insightTick} />
            <span><strong>Fast start:</strong> Generate a key in ~1 minute, no GCP project or billing setup.</span>
          </div>
          <div className={styles.insightItem}>
            <Check className={styles.insightTick} />
            <span><strong>Free tier:</strong> Enough for light personal use right away.</span>
          </div>
          <div className={styles.insightItem}>
            <Check className={styles.insightTick} />
            <span><strong>Simple model selection:</strong> No IAM roles or project IDs to manage.</span>
          </div>
          <div className={styles.insightItem}>
            <X className={styles.insightCross} />
            <span><strong>Less privacy:</strong> Requests are processed on Google servers, not your machine.</span>
          </div>
          <div className={styles.insightItem}>
            <X className={styles.insightCross} />
            <span><strong>Strict rate limits:</strong> Free tier is throttled per minute / per day.</span>
          </div>
          <div className={styles.insightItem}>
            <X className={styles.insightCross} />
            <span><strong>Key risk:</strong> A leaked key can be abused / incur unbudgeted charges.</span>
          </div>
        </div>
      </div>

      <div className={styles.tierGrid}>
        <div className={styles.tierCard}>
          <div className={styles.tierHead}>
            <GraduationCap className={`${styles.tierIcon} ${styles.tierIconFree}`} />
            <span className={styles.tierName}>Free Tier</span>
          </div>
          <p className={styles.tierPrice}>
            $0 <span>/ month</span>
          </p>
          <div className={styles.tierList}>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckFree}`} />
              <span>Limited requests per minute &amp; day</span>
            </div>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckFree}`} />
              <span>Free-tier models only (no 2.5 Pro)</span>
            </div>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckFree}`} />
              <span>Good for testing &amp; light transcription</span>
            </div>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckFree}`} />
              <span>Rate-limit 429 errors on heavy use</span>
            </div>
          </div>
        </div>

        <div className={`${styles.tierCard} ${styles.tierCardPopular}`}>
          <span className={styles.tierRibbon}>Recommended</span>
          <div className={styles.tierHead}>
            <Briefcase className={`${styles.tierIcon} ${styles.tierIconPaid}`} />
            <span className={styles.tierName}>Paid (Pay-as-you-go)</span>
          </div>
          <p className={styles.tierPrice}>
            Pay <span>per request</span>
          </p>
          <div className={styles.tierList}>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckPaid}`} />
              <span>Higher / less restrictive rate limits</span>
            </div>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckPaid}`} />
              <span>Access to latest models (2.5 Pro, etc.)</span>
            </div>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckPaid}`} />
              <span>Reliable for batch / long sessions</span>
            </div>
            <div className={styles.tierItem}>
              <Check className={`${styles.tierCheck} ${styles.tierCheckPaid}`} />
              <span>You pay only for what you use</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.insightCard}`}>
        <div className={styles.insightHeader}>
          <div className={styles.insightTitle}>
            <Sparkles className={styles.insightIcon} />
            <span>Prefer maximum privacy?</span>
          </div>
          <Badge variant="outline" className={styles.insightBadge}>
            Alternative
          </Badge>
        </div>
        <div className={styles.insightList}>
          <div className={styles.insightItem}>
            <Check className={styles.insightTick} />
            <span>
              Use <strong>Vertex AI</strong> on the other tab for <strong>local data sovereignty</strong> —
              credentials stay local and requests are made directly from your machine.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
