import { useEffect, useState } from 'react';

interface AssessmentTimerProps {
  questionStartedAt: string;
  allowedSeconds: number;
  onDisplayExpired?: () => void;
}

export function AssessmentTimer({ questionStartedAt, allowedSeconds, onDisplayExpired }: AssessmentTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(questionStartedAt, allowedSeconds));

  useEffect(() => {
    let expiredNotified = false;
    const update = () => {
      const remaining = getRemainingSeconds(questionStartedAt, allowedSeconds);
      setRemainingSeconds(remaining);
      if (remaining === 0 && !expiredNotified) {
        expiredNotified = true;
        onDisplayExpired?.();
      }
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [allowedSeconds, onDisplayExpired, questionStartedAt]);

  return <strong aria-label="Time remaining">{remainingSeconds}s</strong>;
}

function getRemainingSeconds(questionStartedAt: string, allowedSeconds: number): number {
  const elapsedSeconds = Math.floor((Date.now() - Date.parse(questionStartedAt)) / 1000);
  return Math.max(0, allowedSeconds - elapsedSeconds);
}
