import { useEffect, useState } from 'react';

export default function useTimer(initialSeconds) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    setTimeLeft(initialSeconds);
    setIsExpired(false);
  }, [initialSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }
    const tick = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsExpired(true);
          clearInterval(tick);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [timeLeft === initialSeconds]);

  return { timeLeft, isExpired };
}
