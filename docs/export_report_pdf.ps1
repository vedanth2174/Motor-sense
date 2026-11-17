param(
    [string]$DocxPath = "D:\project\BACKUP PROJECT\docs\MotorSense_Project_Report.docx",
    [string]$PdfPath = "D:\project\BACKUP PROJECT\docs\MotorSense_Project_Report.pdf"
)

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   MotorSense Project Report - PDF Generator" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Checking input document: $DocxPath"

if (-not (Test-Path $DocxPath)) {
    Write-Host "ERROR: File not found: $DocxPath" -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Launching Microsoft Word in background..."
$word = $null
$doc = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.ScreenUpdating = $false

    Write-Host "      Opening document..."
    $doc = $word.Documents.Open($DocxPath)

    Write-Host "[3/3] Exporting pixel-perfect PDF with full styling..."
    Write-Host "      Destination: $PdfPath"
    
    # 17 = wdFormatPDF
    $doc.SaveAs([ref]$PdfPath, [ref]17)
    $doc.Close([ref]$false)
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "   SUCCESS: PDF Generated Successfully!" -ForegroundColor Green
    Write-Host "   Saved at: $PdfPath" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
}
catch {
    Write-Host "ERROR during PDF generation: $_" -ForegroundColor Red
    if ($doc) { $doc.Close([ref]$false) }
    if ($word) { $word.Quit() }
    exit 1
}
