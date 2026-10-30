import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { appearanceForPublicSpace, bodyFamilyFor, normalizeCharacterAppearance } from "../character-system/appearance";
import { compatibleCatalogOptions, firstCompatibleHairColor } from "../character-system/registry";
import type { CharacterAppearance } from "../character-system/types";
import { generaAspettoDaSeed, type AspettoPersonaggio } from "../game/personaggioAspetto";
import {
  applyProfessionUniform, clearProfessionUniform, extractProfessionUniform,
  getProfessionUniforms, loadProfessionUniforms, PROFESSION_ROLES,
  saveProfessionUniform, saveProfessionUniforms,
  type ProfessionRoleId, type ProfessionUniforms
} from "../game/professionOutfitTemplates";
import { CharacterCreationPreview } from "./CharacterCreationPreview";
import { CircularSpriteFrame } from "./CircularSpriteFrame";
import { CreazioneGiocatoreModal, type DatiCreazioneGiocatore } from "./CreazioneGiocatoreModal";

function previewAppearance(
  role: typeof PROFESSION_ROLES[number],
  sex: "M"|"F",
  serial: number,
  uniform: ProfessionUniforms[ProfessionRoleId]
): { appearance: CharacterAppearance; aspetto: AspettoPersonaggio } {
  const base=generaAspettoDaSeed("Umano",serial,{sesso:sex});
  const original=base.characterAppearance!;
  const body=role.bodyType==="teen"?"teen":(sex==="F"?"female":"male");
  const ageGroup=body==="teen"?"teen":"adult";
  const withBody=normalizeCharacterAppearance({
    ...original,bodyType:body,ageGroup,bodyFamily:bodyFamilyFor("human",ageGroup),
    ...(role.id==="re"?{headwear:"crown"}:{})
  });
  // Use two intentionally different hair selections to make the unchanged faces visible.
  const catalog=compatibleCatalogOptions(withBody,{allowRoyalHeadwear:role.id==="re"});
  const candidates=catalog.hairStyles.filter(h=>h!=="none");
  const hairStyle=candidates.length?candidates[serial%candidates.length]! : withBody.hairStyle;
  const hairColor=firstCompatibleHairColor({...withBody,hairStyle},hairStyle);
  const individual=normalizeCharacterAppearance({...withBody,hairStyle,hairColor});
  const publicAppearance=appearanceForPublicSpace(individual,{
    isKing:role.id==="re",nudismoAttivo:false,lavoro:role.lavoro,
    seed:serial,razza:"Umano",sesso:sex
  });
  const result=applyProfessionUniform(publicAppearance,role.lavoro,{
    isKing:role.id==="re",override:uniform??null
  });
  return {appearance:result,aspetto:{...base,characterAppearance:result}};
}

type Props={onExit:()=>void};
export function ProfessionOutfitEditorScreen({onExit}:Props){
  const [roleId,setRoleId]=useState<ProfessionRoleId>("agricoltore");
  const [uniforms,setUniforms]=useState<ProfessionUniforms>({});
  const [loaded,setLoaded]=useState(false);
  const [invalid,setInvalid]=useState(false);
  const [editing,setEditing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [variant,setVariant]=useState(0);
  const [exportOpen,setExportOpen]=useState(false);

  useEffect(()=>{
    let live=true;
    void loadProfessionUniforms(AsyncStorage).then(value=>{
      if(live){setUniforms(value);setLoaded(true);}
    }).catch(()=>{
      if(live){setInvalid(true);setLoaded(true);setError("Archivio delle divise non leggibile: non verrà sovrascritto automaticamente.");}
    });
    return ()=>{live=false;};
  },[]);

  const role=PROFESSION_ROLES.find(r=>r.id===roleId)!;
  const uniform=uniforms[roleId];
  const examples=useMemo(()=>[
    previewAppearance(role,"M",101+variant*2,uniform),
    previewAppearance(role,"M",102+variant*2,uniform)
  ],[role,uniform,variant]);

  const exportText=useMemo(()=>{
    const selected=PROFESSION_ROLES.filter(role=>uniforms[role.id]);
    return [
      "MYKINGDOM — DIVISE STANDARD PROPOSTE",
      "Configurazione v1; viso, capelli, barba e pelle individuali.",
      ...selected.map(role=>{
        const u=uniforms[role.id]!;
        return [
          role.label+" ["+role.id+"]",
          "Busto: "+u.upperOutfit+"; gambe: "+u.lowerOutfit+"; veste: "+u.fullOutfit,
          "Colori: "+u.outfitPrimaryColor+" / "+u.outfitSecondaryColor,
          "Cappello: "+u.headwear+"; mantello: "+u.cape+"; calzature: "+u.footwear,
          "Accessorio: "+u.accessory+"; rifiniture: "+u.fullOutfitTrim+" / "+u.capeTrim
        ].join("\n");
      })
    ].join("\n\n");
  },[uniforms]);
  const shareChoices=async()=>{
    setError(null);
    try{
      await Share.share({title:"Divise professioni MyKingdom",message:exportText});
    }catch{
      setError("La condivisione non è disponibile: seleziona e copia il testo qui sotto.");
    }
  };

  const modalInitial:DatiCreazioneGiocatore=useMemo(()=>({
    nome:role.label,cognome:"",sesso:"M",orientamento:"Etero",razza:"Umano",
    aspetto:examples[0]!.aspetto
  }),[role,examples]);
  const save=async(data:DatiCreazioneGiocatore)=>{
    if(!data.aspetto.characterAppearance||busy||invalid)return;
    setBusy(true);
    setError(null);
    try{
      await saveProfessionUniform(AsyncStorage,roleId,extractProfessionUniform(data.aspetto.characterAppearance));
      setUniforms(getProfessionUniforms());
      setEditing(false);
      setNotice("Divisa "+role.label+" salvata. Volti, capelli e barbe restano individuali.");
    }catch{
      setError("Salvataggio non riuscito. La modifica non è stata applicata.");
    }finally{setBusy(false);}
  };
  const restore=async()=>{
    if(busy||invalid)return;
    setBusy(true);
    try{
      await clearProfessionUniform(AsyncStorage,roleId);
      setUniforms(getProfessionUniforms());
      setNotice("Ripristinato l'abbigliamento originale di "+role.label+".");
      setError(null);
    }catch{setError("Impossibile ripristinare la divisa.");}
    finally{setBusy(false);}
  };
  const replaceBroken=async()=>{
    if(busy)return;
    setBusy(true);
    try{
      // Explicit user action only; never silently overwrite an unreadable file.
      await saveProfessionUniforms(AsyncStorage,{});
      setUniforms({});
      setInvalid(false);
      setError(null);
      setNotice("Archivio divise ricreato. Nessuna partita è stata cancellata.");
    }catch{setError("Non è stato possibile ripristinare l'archivio.");}
    finally{setBusy(false);}
  };

  return (
    <SafeAreaView style={styles.root} testID="profession-editor-root">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Torna al menu" testID="profession-editor-exit"
          onPress={onExit} style={styles.back}>
          <Text style={styles.light}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.heading}>Editor abiti</Text>
      </View>
      {!loaded?<View style={styles.loading}><ActivityIndicator/><Text style={styles.muted}>Caricamento divise…</Text></View>:
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Scegli il mestiere e componi la divisa con gli sprite originali LPC.
          Solo i vestiti saranno uguali per professione: ogni cittadino conserverà viso, pelle, capelli e barba propri.
        </Text>
        {error?<Text testID="profession-editor-error" style={styles.error}>{error}</Text>:null}
        {notice?<Text testID="profession-editor-notice" style={styles.notice}>{notice}</Text>:null}
        {invalid?
          <Pressable onPress={()=>{void replaceBroken();}} disabled={busy} accessibilityRole="button"
            accessibilityLabel="Ricrea solo l'archivio divise" style={styles.danger}>
            <Text style={styles.light}>Ripristina archivio divise</Text>
          </Pressable>:null}
        <Text style={styles.section}>Professioni</Text>
        <View style={styles.roles} testID="profession-editor-roles">
          {PROFESSION_ROLES.map(r=><Pressable key={r.id} testID={"profession-role-"+r.id}
            accessibilityRole="button" accessibilityLabel={"Scegli "+r.label}
            accessibilityState={{selected:roleId===r.id}}
            onPress={()=>{setRoleId(r.id);setNotice(null);setError(invalid?error:null);}}
            style={[styles.role,roleId===r.id&&styles.roleSelected]}>
            <Text style={styles.roleText}>{r.label}</Text>
            {uniforms[r.id]?<Text style={styles.savedMark}> ●</Text>:null}
          </Pressable>)}
        </View>
        <View style={styles.previewPanel}>
          <Text style={styles.section}>{role.label} {uniform?"· divisa personalizzata":"· divisa originale"}</Text>
          <View style={styles.previews} testID="profession-editor-previews">
            <View style={styles.preview}>
              <CharacterCreationPreview appearance={examples[0]!.appearance} size={100} compact />
              <Text style={styles.muted}>Abitante A</Text>
            </View>
            <View style={styles.preview}>
              <CircularSpriteFrame appearance={examples[1]!.appearance} size={108} animate={false}/>
              <Text style={styles.muted}>Abitante B</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Mostra altri volti con la stessa divisa"
            style={styles.otherFaces} onPress={()=>setVariant(v=>v+1)} testID="profession-editor-other-faces">
            <Text style={styles.light}>Mostra altri volti</Text>
          </Pressable>
          <Text style={styles.caption}>
            Due persone diverse con la stessa uniforme. Cambia i volti per controllare che capelli e barba non siano fissati.
          </Text>
        </View>
        <Pressable testID="profession-editor-edit" accessibilityRole="button" accessibilityLabel={"Modifica divisa "+role.label}
          disabled={busy||invalid} style={[styles.primary,(busy||invalid)&&styles.disabled]} onPress={()=>setEditing(true)}>
          <Text style={styles.primaryText}>Modifica divisa di {role.label}</Text>
        </Pressable>
        {uniform?<Pressable testID="profession-editor-reset" accessibilityRole="button"
          accessibilityLabel={"Ripristina divisa "+role.label}
          disabled={busy||invalid} style={styles.secondary} onPress={()=>{void restore();}}>
          <Text style={styles.light}>Ripristina divisa originale</Text>
        </Pressable>:null}
        <Pressable testID="profession-editor-export" accessibilityRole="button"
          accessibilityLabel="Mostra configurazione delle divise per inviarla allo sviluppatore"
          style={styles.exportButton} onPress={()=>setExportOpen(v=>!v)}>
          <Text style={styles.light}>{exportOpen?"Nascondi configurazione":"Condividi configurazione"}</Text>
        </Pressable>
        {exportOpen?<View testID="profession-editor-export-text" style={styles.exportPanel}>
          <Text style={styles.caption}>Seleziona e copia queste scelte nella nostra chat: potranno diventare le divise predefinite per tutti i giocatori.</Text>
          <Text selectable style={styles.exportText}>{exportText}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Condividi le divise selezionate"
            style={styles.secondary} onPress={()=>{void shareChoices();}}>
            <Text style={styles.light}>Condividi tramite dispositivo</Text>
          </Pressable>
        </View>:null}
        <Text style={styles.footnote}>Le preferenze sono salvate sul dispositivo, separatamente dalle partite. Condividendole potremo inserirle come impostazione standard del gioco.</Text>
      </ScrollView>}
      <CreazioneGiocatoreModal
        visible={editing} mode="outfit" initial={modalInitial}
        titolo={"Divisa: "+role.label} onConferma={save}
        onAnnulla={()=>{if(!busy)setEditing(false);}}
      />
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#050816"},
  header:{flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingVertical:12,gap:18,
    borderBottomWidth:1,borderBottomColor:"#334155"},
  heading:{fontSize:21,fontWeight:"800",color:"#fff"},
  back:{backgroundColor:"#334155",paddingHorizontal:12,paddingVertical:10,borderRadius:9},
  light:{color:"#f8fafc",fontWeight:"700",textAlign:"center"},
  loading:{flex:1,alignItems:"center",justifyContent:"center",gap:12},
  muted:{color:"#cbd5e1",fontSize:12,textAlign:"center"},
  content:{padding:16,paddingBottom:42,gap:14,maxWidth:650,width:"100%",alignSelf:"center"},
  intro:{color:"#cbd5e1",lineHeight:21,fontSize:14},
  section:{color:"#f8fafc",fontSize:18,fontWeight:"800"},
  roles:{flexDirection:"row",flexWrap:"wrap",gap:8},
  role:{borderWidth:1,borderColor:"#475569",backgroundColor:"#172337",
    paddingHorizontal:12,paddingVertical:11,borderRadius:10,flexDirection:"row",alignItems:"center"},
  roleSelected:{borderColor:"#86efac",backgroundColor:"#22543b"},
  roleText:{color:"#fff",fontSize:12,fontWeight:"700"},
  savedMark:{color:"#86efac"},
  previewPanel:{backgroundColor:"#101d2e",borderRadius:16,padding:14,gap:10,
    borderWidth:1,borderColor:"#334155"},
  previews:{flexDirection:"row",justifyContent:"space-around",alignItems:"center",flexWrap:"wrap",gap:8},
  preview:{alignItems:"center",gap:6,minWidth:130},
  otherFaces:{alignSelf:"center",backgroundColor:"#334155",padding:11,borderRadius:9},
  caption:{color:"#94a3b8",fontSize:12,lineHeight:18,textAlign:"center"},
  primary:{backgroundColor:"#166534",padding:15,borderRadius:11,borderWidth:1,borderColor:"#86efac"},
  primaryText:{color:"#fff",fontSize:15,fontWeight:"800",textAlign:"center"},
  secondary:{backgroundColor:"#334155",padding:13,borderRadius:9},
  disabled:{opacity:0.45},
  error:{backgroundColor:"#65272c",color:"#ffe2e2",padding:12,borderRadius:9},
  notice:{backgroundColor:"#174f3b",color:"#e8fff1",padding:12,borderRadius:9},
  danger:{backgroundColor:"#9a3412",padding:12,borderRadius:10},
  exportButton:{backgroundColor:"#254770",padding:13,borderRadius:10},
  exportPanel:{borderWidth:1,borderColor:"#475569",padding:12,borderRadius:10,gap:12},
  exportText:{fontSize:12,color:"#e2e8f0",lineHeight:19},
  footnote:{color:"#64748b",textAlign:"center",fontSize:11}
});
