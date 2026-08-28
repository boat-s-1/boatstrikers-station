export default function Template({ children }) {
  return (
    <>
      {children}
      <style>{`
        /* TOP: 最新の予想新聞を横スライド表示 */
        .todayNewsGrid {
          display: flex !important;
          gap: 14px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding: 2px 2px 14px !important;
          scroll-snap-type: x mandatory;
          scroll-padding-left: 2px;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-inline: contain;
          scrollbar-width: none;
        }

        .todayNewsGrid::-webkit-scrollbar {
          display: none;
        }

        .todayNewsCard {
          flex: 0 0 88% !important;
          width: 88% !important;
          min-width: 0;
          scroll-snap-align: start;
          scroll-snap-stop: always;
        }

        @media (max-width: 380px) {
          .todayNewsCard {
            flex-basis: 90% !important;
            width: 90% !important;
            grid-template-columns: 104px minmax(0, 1fr) !important;
          }

          .todayNewsCard img {
            width: 104px !important;
            height: 82px !important;
          }
        }

        @media (min-width: 680px) {
          .todayNewsGrid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            overflow: visible !important;
            padding-bottom: 2px !important;
          }

          .todayNewsCard {
            width: auto !important;
          }
        }
      `}</style>
    </>
  );
}
