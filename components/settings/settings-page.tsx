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
            href="/" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            ← {t('common.back')}
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('project.settings')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === 'de' 
              ? 'Verwalte deine Anwendungseinstellungen'
              : 'Manage your application preferences'}
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
                  {language === 'de' ? 'Sprache' : 'Language'}
                </CardTitle>
                <CardDescription>
                  {language === 'de' 
                    ? 'Wähle deine bevorzugte Sprache für die gesamte Anwendung'
                    : 'Choose your preferred language for the entire application'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-base font-medium">
                  {language === 'de' ? 'Anwendungssprache' : 'Application Language'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {language === 'de'
                    ? 'Diese Einstellung gilt für alle Projekte und die gesamte Benutzeroberfläche'
                    : 'This setting applies to all projects and the entire user interface'}
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
                      <div className="font-semibold">English</div>
                      <div className="text-xs opacity-70">International</div>
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
                      <div className="font-semibold">Deutsch</div>
                      <div className="text-xs opacity-70">Deutschland</div>
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
                  {language === 'de' ? (
                    <>
                      <strong>Hinweis:</strong> Die Spracheinstellung wird in deinem Browser gespeichert und 
                      bleibt auch nach einem Neustart erhalten.
                    </>
                  ) : (
                    <>
                      <strong>Note:</strong> Your language preference is saved in your browser and will persist 
                      across sessions.
                    </>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Future Settings Placeholder */}
        <div className="mt-8 p-6 rounded-lg border border-dashed border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            {language === 'de' 
              ? 'Weitere Einstellungen werden in zukünftigen Updates verfügbar sein'
              : 'More settings will be available in future updates'}
          </p>
        </div>
      </div>
    </div>
  );
}
