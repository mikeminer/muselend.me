"use client";
import {useLocale,useTranslations} from "next-intl";import {Languages} from "lucide-react";import {Button} from "@/components/ui/button";
export function LocaleSwitcher(){const locale=useLocale();const t=useTranslations("Locale");return <Button variant="ghost" size="sm" onClick={()=>{document.cookie=`locale=${locale==="en"?"it":"en"}; Path=/; Max-Age=31536000; SameSite=Lax`;location.reload()}} aria-label={`Switch language: ${t("switch")}`}><Languages/><span className="hidden lg:inline">{t("switch")}</span></Button>}
