const defaultRaceNames = [
  "予選",
  "予選",
  "予選",
  "予選",
  "予選",
  "予選",
  "予選",
  "予選特賞",
  "予選特賞",
  "特賞",
  "選抜戦",
  "ドリーム戦",
];

const defaultDeadlineTimes = [
  "15:17",
  "15:43",
  "16:09",
  "16:35",
  "17:01",
  "17:28",
  "17:55",
  "18:23",
  "18:52",
  "19:22",
  "19:53",
  "20:35",
];

const racerNames = [
  "山田 太郎",
  "佐藤 次郎",
  "高橋 健一",
  "田中 和也",
  "鈴木 翔",
  "伊藤 大輔",
  "中村 亮",
  "小林 直樹",
  "加藤 裕二",
  "吉田 拓海",
  "山本 浩二",
  "松本 一樹",
  "井上 翼",
  "木村 誠",
  "林 大地",
  "清水 健太",
  "山口 翔太",
  "森 健一郎",
];

function createRacers(raceNo) {
  return Array.from({ length: 6 }, (_, index) => {
    const nameIndex = (raceNo * 3 + index) % racerNames.length;

    return {
      boatNo: index + 1,
      name: racerNames[nameIndex],
      className:
        index === 0 || (raceNo + index) % 5 === 0
          ? "A1"
          : (raceNo + index) % 3 === 0
            ? "A2"
            : "B1",
      nationalRate: Number(
        (4.2 + ((raceNo * 7 + index * 11) % 31) / 10).toFixed(2)
      ),
      localRate: Number(
        (4.0 + ((raceNo * 5 + index * 9) % 29) / 10).toFixed(2)
      ),
      averageStart: Number(
        (0.11 + ((raceNo + index * 2) % 10) / 100).toFixed(2)
      ),
    };
  });
}

function createRace({
  raceNo,
  raceName,
  deadline,
  status = "before",
  ichika = false,
  hatsune = false,
  kiina = false,
}) {
  return {
    raceNo,
    raceName,
    deadline,
    status,
    racers: createRacers(raceNo),

    predictions: {
      ichika,
      hatsune,
      kiina,
    },

    ichikaScore: ichika
      ? 68 + ((raceNo * 7) % 27)
      : null,

    kiinaScore: kiina
      ? 40 + ((raceNo * 9) % 44)
      : null,
  };
}

function createCourseRaces(courseCode) {
  return Array.from({ length: 12 }, (_, index) => {
    const raceNo = index + 1;

    return createRace({
      raceNo,
      raceName:
        raceNo === 12
          ? courseCode === "07"
            ? "優勝戦"
            : defaultRaceNames[index]
          : defaultRaceNames[index],

      deadline: defaultDeadlineTimes[index],

      status:
        raceNo <= 2
          ? "closed"
          : raceNo === 3
            ? "soon"
            : "before",

      ichika: [3, 7, 10, 12].includes(raceNo),
      hatsune: [6, 11].includes(raceNo),
      kiina: [5, 9, 12].includes(raceNo),
    });
  });
}

export const raceSchedule = {
  "01": createCourseRaces("01"),
  "02": createCourseRaces("02"),
  "07": createCourseRaces("07"),
  "08": createCourseRaces("08"),
  "11": createCourseRaces("11"),
  "12": createCourseRaces("12"),
  "13": createCourseRaces("13"),
  "16": createCourseRaces("16"),
  "17": createCourseRaces("17"),
  "18": createCourseRaces("18"),
  "21": createCourseRaces("21"),
  "24": createCourseRaces("24"),
};

export function getCourseRaces(courseCode) {
  return raceSchedule[courseCode] || createCourseRaces(courseCode);
}
