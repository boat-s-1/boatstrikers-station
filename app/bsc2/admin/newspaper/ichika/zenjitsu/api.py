from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from playwright.async_api import Browser, Playwright, async_playwright

from ichika_zenjitsu_generator import create_ichika_html

browser: Browser | None = None
playwright_instance: Playwright | None = None
browser_lock = asyncio.Lock()


class IchikaRequest(BaseModel):
    raceDate: str
    place: str
    raceNo: str
    honmei: str
    stamp: str = "なし"
    nigeRate: int = Field(ge=0, le=100)
    upRate: int = Field(ge=-30, le=30)
    selectedBoats: list[str]
    boatScores: dict[str, int]
    boatComments: dict[str, str]
    mainComment: str = ""
    wave: int = Field(ge=0, le=100)
    dangerBoat: str = "なし"
    motorEval: str = ""
    characterImage: str = ""
    backgroundImage: str = ""


@asynccontextmanager
async def lifespan(_: FastAPI):
    global browser, playwright_instance

    playwright_instance = await async_playwright().start()
    browser = await playwright_instance.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    )

    yield

    if browser is not None:
        await browser.close()

    if playwright_instance is not None:
        await playwright_instance.stop()


app = FastAPI(
    title="BOAT STRIKE Image API",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://boat-strike.online,https://www.boat-strike.online,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/generate/ichika/zenjitsu")
async def generate_ichika_zenjitsu(payload: IchikaRequest):
    if browser is None:
        raise HTTPException(
            status_code=503,
            detail="画像生成ブラウザを準備中です",
        )

    async with browser_lock:
        page = await browser.new_page(
            viewport={"width": 1100, "height": 2200},
            device_scale_factor=2,
        )

        try:
            html_text = create_ichika_html(payload.model_dump())

            await page.set_content(
                html_text,
                wait_until="load",
                timeout=30_000,
            )

            await page.evaluate(
                """
                async () => {
                  if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                  }

                  const images = Array.from(document.images);

                  await Promise.all(
                    images.map((image) => {
                      if (image.complete) return Promise.resolve();

                      return new Promise((resolve) => {
                        image.addEventListener("load", resolve, { once: true });
                        image.addEventListener("error", resolve, { once: true });
                      });
                    })
                  );
                }
                """
            )

            target = page.locator("#newspaper")
            await target.wait_for(state="visible", timeout=10_000)

            png_bytes = await target.screenshot(
                type="png",
                animations="disabled",
                scale="device",
                timeout=30_000,
            )

            return Response(
                content=png_bytes,
                media_type="image/png",
                headers={
                    "Content-Disposition": 'inline; filename="ichika-zenjitsu.png"',
                    "Cache-Control": "no-store",
                },
            )

        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail=f"新聞画像の生成に失敗しました: {error}",
            ) from error

        finally:
            await page.close()
