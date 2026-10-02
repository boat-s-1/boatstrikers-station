// Verified against main eb99c3f. Pose IDs are stable; filenames are never inferred.
export const BLOG_CHARACTERS = {
  ichika: { name: "一果", kind: "human", poses: {
    pose1: "1ACA9B26-D8E5-4625-8D60-4656633FA558.png", pose2: "4E9F8775-50F8-4BC9-A353-F2222A8D0232.png",
    pose3: "52491535-8caf-4b61-a6af-91cfbea6ac3b.png", pose4: "93101114-89EC-4754-BD11-F1615725A394.png", pose5: "C402673C-5EB9-4B09-96CF-9FF4B6138382.png",
  } },
  hatsune: { name: "初音", kind: "human", poses: {
    pose1: "63DB17FA-E17B-4F8E-91B2-906C201321D9.png", pose2: "2DC20DA0-72ED-4B15-AB72-C7377B4DF206.png",
    pose3: "B0EA9E41-84C4-41D4-B09C-0D4023F380E0.png", pose4: "90618A5A-405E-4FC8-A9C6-D786CAF2F7F2.png", pose5: "E0C288ED-9FAF-4964-B955-FA5FAB4EEC10.png",
  } },
  kiina: { name: "キイナ", kind: "human", poses: {
    pose1: "25BDA4F5-6FC6-46B5-A7FE-1AA003E0231B.png", pose2: "AA33DCF0-A2C3-480B-A03A-7DAA6AF9FB1F.png",
    pose3: "C12025A4-CF54-450B-9644-8E400F0EB4DE.png", pose4: "BCCFBCE0-19E3-4AD0-AE46-F22B6A75EEF1.png", pose5: "CA1710C0-A632-4ED3-A1CD-6BDBE9F68F2E.png",
  } },
  ichimaru: { name: "いちまる", kind: "mate", poses: {
    pose1: "03537EAC-91E6-45E9-AD64-5582CE3EF400.png", pose2: "6D67CBBF-C0D4-48FB-9824-F93D34EBC406.png",
    pose3: "7292B491-BFE7-4203-811E-0F9931F63219.png", pose4: "792C96F1-7809-4460-9263-474CEEE68003.png",
    pose5: "8BB3355E-BBE9-4C38-92C1-B6E0D35BB7BD.png", pose6: "98D711C8-F6F9-4D49-B7E3-3B99800D019B.png",
  } },
  hatsukoro: { name: "はつころ", kind: "mate", poses: {
    pose1: "1BB2D92E-52F0-42F0-8582-C144F0D3DDC3.png", pose2: "48C1A7CB-6897-4E95-9831-3034C61CC6BA.png",
    pose3: "4E9FA278-4FE7-4E55-8920-FD8725779459.png", pose4: "A7688846-8FA2-4A24-A8DF-9F48382FFA82.png", pose5: "DC6158C5-FFD6-4B5C-B77F-EB0AFAA02FC5.png",
  } },
  kiimoko: { name: "きいもこ", kind: "mate", poses: {
    pose1: "6712171A-5389-42A8-81C6-3D156A9B9E81.png", pose2: "69422FEB-0DC5-4F8D-98B3-21F48D6F5B63.png",
    pose3: "821F9503-E828-46A6-9574-C63B7F739718.png", pose4: "A236743D-CDC9-4B8A-8590-3F63F6927CCC.png", pose5: "FDA2388B-4EFF-496C-BDB7-B968A4C8C6EB.png",
  } },
};

export function characterImage(character, pose) {
  const filename = BLOG_CHARACTERS[character]?.poses[pose];
  if (!filename) throw new Error("Unknown BLOG character/pose");
  return `/anime/${character}/${filename}`;
}

// Confirmed against GUIDE_CAST in app/guide/GuideConversation.js.
// Pose numbers remain the persisted IDs; these labels only help manual selection.
export const HUMAN_POSE_LABELS = {
  ichika: {pose1:'説明',pose2:'考える',pose3:'質問',pose4:'まとめ',pose5:'案内'},
  hatsune: {pose1:'説明',pose2:'考える',pose3:'質問',pose4:'まとめ',pose5:'案内'},
  kiina: {pose1:'説明',pose2:'考える',pose3:'質問',pose4:'まとめ',pose5:'案内'},
};
export function poseLabel(character,pose){return HUMAN_POSE_LABELS[character]?.[pose]||pose;}
