'use client';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Globe, Check, Key, Bot, Loader2, AlertCircle, ChevronDown, Crop } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { verifyGeminiApiKey } from '@/app/actions/ai';

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();

  const [apiKey, setApiKey] = useState('');
  const [useGlobalModel, setUseGlobalModel] = useState(true);
  const [globalModel, setGlobalModel] = useState('gemini-2.5-flash');
  const [featureModels, setFeatureModels] = useState<{
    generateSummary?: string;
    generateTheory?: string;
    analyzeExercise?: string;
    exerciseChat?: string;
    generateBlocks?: string;
    projectChat?: string;
    generateChatTitle?: string;
    generateExplanation?: string;
    generateExtraExercises?: string;
    extractFormulas?: string;
    generateLearningPath?: string;
  }>({});
  const [saved, setSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imagePreselect, setImagePreselect] = useState<'none' | 'preselect' | 'preselect_extract'>('none');

  useEffect(() => {
    // Load from cookies
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return undefined;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };
    
    const key = getCookie('gemini-api-key');
    const modelsCookie = getCookie('gemini-models');
    const preselectCookie = getCookie('image-preselect');

    if (key) setApiKey(decodeURIComponent(key));
    if (preselectCookie === 'preselect' || preselectCookie === 'preselect_extract' || preselectCookie === 'none') {
      setImagePreselect(preselectCookie);
    }
    
    if (modelsCookie) {
      try {
        const modelsConfig = JSON.parse(decodeURIComponent(modelsCookie));
        if (modelsConfig.global) {
          setUseGlobalModel(true);
          setGlobalModel(modelsConfig.global);
        } else {
          setUseGlobalModel(false);
          setFeatureModels(modelsConfig);
        }
      } catch (e) {
        console.error('Failed to parse models config:', e);
      }
    }
  }, []);

  const handleSaveAiSettings = async () => {
    setIsChecking(true);
    setError(null);
    setSaved(false);

    if (apiKey.trim()) {
        try {
            const result = await verifyGeminiApiKey(apiKey);
            if (!result.success) {
                setError(t('settings.invalidApiKey') || result.error || "Invalid API Key"); 
            } else {
                saveSettings();
            }
        } catch (e) {
            setError("Validation failed");
        }
    } else {
        // Allow saving empty key
        saveSettings();
    }
    
    setIsChecking(false);
  };

  const saveSettings = () => {
    const maxAge = 31536000; // 1 year
    document.cookie = `gemini-api-key=${encodeURIComponent(apiKey)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    
    // Build model configuration
    const modelConfig = useGlobalModel 
      ? { global: globalModel }
      : featureModels;
    
    document.cookie = `gemini-models=${encodeURIComponent(JSON.stringify(modelConfig))}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `image-preselect=${imagePreselect}; path=/; max-age=${maxAge}; SameSite=Lax`;

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  };

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

        {/* AI Settings Card */}
        <Card className="clean-card overflow-hidden mt-8">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>
                  {t('settings.aiTitle')}
                </CardTitle>
                <CardDescription>
                  {t('settings.aiDescription')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-base font-medium">
                  {t('settings.apiKeyLabel')}
                </Label>
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <Input 
                    id="apiKey" 
                    type="password"
                    placeholder={t('settings.apiKeyPlaceholder')}
                    className="pl-12 h-10 bg-muted/50 border-input/60 hover:bg-muted/80 hover:border-input transition-all"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>

              <Separator className="my-4" />

              {/* Global Model Override */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="useGlobalModel" className="text-base font-medium">
                      {t('settings.globalOverride')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.globalOverrideDescription')}
                    </p>
                  </div>
                  <Switch
                    id="useGlobalModel"
                    checked={useGlobalModel}
                    onCheckedChange={setUseGlobalModel}
                  />
                </div>

                {/* Global Model Selector */}
                {useGlobalModel && (
                  <div className="space-y-2">
                    <Label htmlFor="globalModel" className="text-sm font-medium">
                      {t('settings.globalOverrideModel')}
                    </Label>
                    <Select value={globalModel} onValueChange={setGlobalModel}>
                      <SelectTrigger id="globalModel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash ⭐</SelectItem>
                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                        <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                        <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</SelectItem>
                        <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash Preview</SelectItem>
                        <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro Preview</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Advanced Settings - Per-Feature Configuration */}
              {!useGlobalModel && (
                <>
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium cursor-pointer">
                          {t('settings.advancedSettings')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.advancedSettingsDescription')}
                        </p>
                      </div>
                      <ChevronDown className={`h-5 w-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </div>

                    {showAdvanced && (
                      <div className="space-y-4 pt-2">
                        {/* Feature Model Selectors */}
                        {[
                          { key: 'generateSummary', label: t('settings.features.generateSummary') },
                          { key: 'generateTheory', label: t('settings.features.generateTheory') },
                          { key: 'analyzeExercise', label: t('settings.features.analyzeExercise') },
                          { key: 'exerciseChat', label: t('settings.features.exerciseChat') },
                          { key: 'projectChat', label: t('settings.features.projectChat') },
                          { key: 'generateBlocks', label: t('settings.features.generateBlocks') },
                          { key: 'generateChatTitle', label: t('settings.features.generateChatTitle') },
                          { key: 'generateExplanation', label: t('settings.features.generateExplanation') },
                          { key: 'generateExtraExercises', label: t('settings.features.generateExtraExercises') },
                          { key: 'extractFormulas', label: t('settings.features.extractFormulas') },
                          { key: 'generateLearningPath', label: t('settings.features.generateLearningPath') },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-3">
                            <Label htmlFor={key} className="text-sm min-w-[180px]">
                              {label}
                            </Label>
                            <Select 
                              value={featureModels[key as keyof typeof featureModels] || 'gemini-2.5-flash'} 
                              onValueChange={(value) => setFeatureModels(prev => ({ ...prev, [key]: value }))}
                            >
                              <SelectTrigger id={key} className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash ⭐</SelectItem>
                                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                                <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                                <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                                <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</SelectItem>
                                <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash Preview</SelectItem>
                                <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro Preview</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-4">
                  <Button onClick={handleSaveAiSettings} disabled={isChecking}>
                    {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('settings.save')}
                  </Button>
                  {saved && (
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      {t('settings.saved')}
                    </p>
                  )}
                </div>
                {error && (
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Image Preselect Card */}
        <Card className="clean-card overflow-hidden mt-8">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crop className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>
                  {t('settings.imagePreselect.title')}
                </CardTitle>
                <CardDescription>
                  {t('settings.imagePreselect.description')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Label htmlFor="imagePreselect" className="text-base font-medium">
                {t('settings.imagePreselect.label')}
              </Label>
              <Select
                value={imagePreselect}
                onValueChange={(v) => {
                  setImagePreselect(v as any);
                  // Persist immediately like a switch
                  const maxAge = 31536000;
                  document.cookie = `image-preselect=${v}; path=/; max-age=${maxAge}; SameSite=Lax`;
                }}
              >
                <SelectTrigger id="imagePreselect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('settings.imagePreselect.options.none')}</SelectItem>
                  <SelectItem value="preselect">{t('settings.imagePreselect.options.preselect')}</SelectItem>
                  <SelectItem value="preselect_extract">{t('settings.imagePreselect.options.preselect_extract')}</SelectItem>
                </SelectContent>
              </Select>
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
