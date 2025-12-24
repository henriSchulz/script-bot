'use client';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();

  const handleLanguageChange = (newLanguage: 'en' | 'de') => {
    setLanguage(newLanguage);
    // Force a refresh to update all content
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/projects" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            ← {t('common.back')}
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('project.settings')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Language Settings Card */}
        <Card className="clean-card overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>
                  {t('settings.languageTitle')}
                </CardTitle>
                <CardDescription>
                  {t('settings.languageDescription')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-base font-medium">
                  {t('settings.applicationLanguage')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.appliesToAll')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant={language === 'en' ? 'default' : 'outline'}
                  className="h-auto py-4 px-4 justify-start gap-3 transition-all hover:scale-[1.02]"
                  onClick={() => handleLanguageChange('en')}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-2xl">🇬🇧</div>
                    <div className="text-left">
                      <div className="font-semibold">{t('settings.languages.en.label')}</div>
                      <div className="text-xs opacity-70">{t('settings.languages.en.description')}</div>
                    </div>
                  </div>
                  {language === 'en' && (
                    <Check className="h-5 w-5 ml-auto" />
                  )}
                </Button>

                <Button
                  variant={language === 'de' ? 'default' : 'outline'}
                  className="h-auto py-4 px-4 justify-start gap-3 transition-all hover:scale-[1.02]"
                  onClick={() => handleLanguageChange('de')}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-2xl">🇩🇪</div>
                    <div className="text-left">
                      <div className="font-semibold">{t('settings.languages.de.label')}</div>
                      <div className="text-xs opacity-70">{t('settings.languages.de.description')}</div>
                    </div>
                  </div>
                  {language === 'de' && (
                    <Check className="h-5 w-5 ml-auto" />
                  )}
                </Button>
              </div>

              {/* Info box */}
              <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  <strong>{t('settings.noteLabel')}:</strong> {t('settings.note')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Future Settings Placeholder */}
        <div className="mt-8 p-6 rounded-lg border border-dashed border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            {t('settings.futureSettings')}
          </p>
        </div>
      </div>
    </div>
  );
}
