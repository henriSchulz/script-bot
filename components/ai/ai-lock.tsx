'use client';

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';

interface AiLockProps {
  className?: string;
  variant?: 'fullscreen' | 'card' | 'inline';
}

export function AiLock({ className, variant = 'card' }: AiLockProps) {
  const { dict } = useLanguage();

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-muted", className)}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {dict.ai.aiLock.title}
          </span>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/settings">
            {dict.ai.aiLock.unlock}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300", className)}>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <div className="relative p-8 bg-background rounded-full border-2 border-muted shadow-lg">
          <Lock className="h-16 w-16 text-primary" />
        </div>
      </div>
      
      <h3 className="text-2xl font-bold mb-3 tracking-tight">
        {dict.ai.aiLock.title}
      </h3>
      
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        {dict.ai.aiLock.description}
      </p>

      <Button size="lg" className="gap-2 group shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-semibold" asChild>
        <Link href="/settings">
          <Lock className="h-4 w-4 group-hover:scale-110 transition-transform" />
          {dict.ai.aiLock.button}
        </Link>
      </Button>
    </div>
  );
}
