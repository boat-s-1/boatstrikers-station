import { Suspense } from "react";
import GradeRacePanel from "../GradeRacePanel";
import GradeRaceImageBuilder from "./GradeRaceImageBuilder";

export default function DataLabSocialLayout({children}){
  return <><GradeRacePanel mode="data" /><Suspense fallback={null}><GradeRaceImageBuilder /></Suspense>{children}</>;
}
