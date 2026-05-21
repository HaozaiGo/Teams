import { test, expect } from '@playwright/test'

test('draw pen stroke on canvas', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL(/\/room\//)
  await page.getByRole('button', { name: '画笔' }).click()

  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  if (!box) return

  const x0 = box.x + box.width * 0.3
  const y0 = box.y + box.height * 0.3
  const x1 = box.x + box.width * 0.7
  const y1 = box.y + box.height * 0.7

  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move(x1, y1, { steps: 10 })
  await page.mouse.up()

  await page.waitForTimeout(300)
  const dataUrl = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (!ctx) return ''
    const w = el.width
    const h = el.height
    const img = ctx.getImageData(0, 0, w, h).data
    for (let i = 3; i < img.length; i += 4) {
      if (img[i] > 0) return 'has-pixel'
    }
    return 'blank'
  })
  expect(dataUrl).toBe('has-pixel')
})

test('draw rectangle on canvas', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL(/\/room\//)
  await page.getByRole('button', { name: '矩形' }).click()

  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  if (!box) return

  await page.mouse.move(box.x + 100, box.y + 100)
  await page.mouse.down()
  await page.mouse.move(box.x + 260, box.y + 220, { steps: 8 })
  await page.mouse.up()

  await page.waitForTimeout(300)
  const blank = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (!ctx) return true
    const d = ctx.getImageData(0, 0, el.width, el.height).data
    for (let i = 3; i < d.length; i += 40) if (d[i] > 0) return false
    return true
  })
  expect(blank).toBe(false)
})
