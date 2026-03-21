

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
// FIX: Import 'es' from the correct locale path
import { es } from 'date-fns/locale/es';

export const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="text-sm text-right text-gray-600 dark:text-gray-400">
      <div>{format(time, 'p', { locale: es })}</div>
      <div className="text-xs">{format(time, 'eeee, d MMMM', { locale: es })}</div>
    </div>
  );
};
