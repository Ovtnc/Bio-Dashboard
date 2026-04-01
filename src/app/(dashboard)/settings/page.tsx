"use client";

import { useState } from "react";
import {
  AtSignIcon,
  KeyRoundIcon,
  MicroscopeIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type GeneralForm = {
  username: string;
  email: string;
  profilePhoto: string;
};

type AnalysisForm = {
  pValueThreshold: string;
  log2FcThreshold: string;
};

type SecurityForm = {
  ncbiApiKey: string;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [general, setGeneral] = useState<GeneralForm>({
    username: "Okan",
    email: "okan@biodash.io",
    profilePhoto: "",
  });

  const [analysis, setAnalysis] = useState<AnalysisForm>({
    pValueThreshold: "0.05",
    log2FcThreshold: "1.0",
  });

  const [security, setSecurity] = useState<SecurityForm>({
    ncbiApiKey: "NCBI_API_KEY",
  });

  const saveGeneral = () => {
    if (!general.username.trim()) {
      toast.error("Kullanıcı adı boş bırakılamaz.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(general.email)) {
      toast.error("Geçerli bir e-posta adresi girin.");
      return;
    }

    toast.success("Genel ayarlar kaydedildi.");
  };

  const saveAnalysis = () => {
    const p = Number(analysis.pValueThreshold);
    const l2 = Number(analysis.log2FcThreshold);

    if (Number.isNaN(p) || p <= 0 || p > 1) {
      toast.error("P-Value eşiği 0 ile 1 arasında olmalıdır.");
      return;
    }

    if (Number.isNaN(l2) || l2 < 0) {
      toast.error("Log2FC eşiği 0 veya daha büyük olmalıdır.");
      return;
    }

    toast.success("Analiz ayarları kaydedildi.");
  };

  const saveSecurity = () => {
    if (!security.ncbiApiKey.trim()) {
      toast.error("NCBI API Key boş bırakılamaz.");
      return;
    }

    toast.success("Güvenlik ayarları kaydedildi.");
  };

  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Ayarlar</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Hesap ve analiz parametrelerini kurumsal standartlarda yönetin.
              </p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (value) {
                  setActiveTab(value);
                }
              }}
              className="w-full"
            >
              <TabsList className="w-full justify-start overflow-auto">
                <TabsTrigger value="general">Genel</TabsTrigger>
                <TabsTrigger value="analysis">Analiz Ayarları</TabsTrigger>
                <TabsTrigger value="security">Güvenlik</TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>Genel Profil Ayarları</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="username">
                        <UserRoundIcon className="size-4" />
                        Kullanıcı Adı
                      </Label>
                      <Input
                        id="username"
                        value={general.username}
                        onChange={(event) =>
                          setGeneral((prev) => ({ ...prev, username: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        <AtSignIcon className="size-4" />
                        E-posta
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={general.email}
                        onChange={(event) =>
                          setGeneral((prev) => ({ ...prev, email: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-photo">
                        <UserRoundIcon className="size-4" />
                        Profil Fotoğrafı
                      </Label>
                      <Input
                        id="profile-photo"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setGeneral((prev) => ({
                            ...prev,
                            profilePhoto: event.target.files?.[0]?.name ?? "",
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {general.profilePhoto
                          ? `Seçilen dosya: ${general.profilePhoto}`
                          : "Henüz profil fotoğrafı seçilmedi."}
                      </p>
                    </div>

                    <Button onClick={saveGeneral}>
                      <SaveIcon className="mr-2 size-4" />
                      Genel Ayarları Kaydet
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analysis">
                <Card>
                  <CardHeader>
                    <CardTitle>Analiz Parametreleri</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="p-threshold">
                        <MicroscopeIcon className="size-4" />
                        P-Value Eşiği
                      </Label>
                      <Input
                        id="p-threshold"
                        type="number"
                        step="0.001"
                        min="0"
                        max="1"
                        value={analysis.pValueThreshold}
                        onChange={(event) =>
                          setAnalysis((prev) => ({
                            ...prev,
                            pValueThreshold: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="log2fc-threshold">
                        <SlidersHorizontalIcon className="size-4" />
                        Log2FC Eşiği
                      </Label>
                      <Input
                        id="log2fc-threshold"
                        type="number"
                        step="0.1"
                        min="0"
                        value={analysis.log2FcThreshold}
                        onChange={(event) =>
                          setAnalysis((prev) => ({
                            ...prev,
                            log2FcThreshold: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <Button onClick={saveAnalysis}>
                      <SaveIcon className="mr-2 size-4" />
                      Analiz Ayarlarını Kaydet
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle>Güvenlik ve Anahtar Yönetimi</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="ncbi-api-key">
                        <KeyRoundIcon className="size-4" />
                        NCBI API Key
                      </Label>
                      <Input
                        id="ncbi-api-key"
                        type="password"
                        value={security.ncbiApiKey}
                        onChange={(event) =>
                          setSecurity((prev) => ({ ...prev, ncbiApiKey: event.target.value }))
                        }
                      />
                    </div>

                    <Button onClick={saveSecurity}>
                      <SaveIcon className="mr-2 size-4" />
                      Güvenlik Ayarlarını Kaydet
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
      </section>
    </main>
  );
}
