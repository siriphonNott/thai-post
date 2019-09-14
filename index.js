const express = require('express')
const app = express()
const puppeteer = require('puppeteer');
const port = process.env.PORT || 3001;


app.get('/', (req, res)=>{
  res.send({"status": "ok"});
});

app.get('/thai-post/:emsid', function (req, res) {
  let result = {
    "success": true,
    "data" : null
  };
  var emsid = req.params.emsid;
  logger(`Checking emsid: ${emsid}`);
  (async () => {
    const browser = await puppeteer.launch({
      headless: true
    }); // default is true (not show chrome)

    const page = await browser.newPage();
    await page.goto('http://track.thailandpost.co.th/tracking/default.aspx?lang=th', {
      "waitUntil": "networkidle2"
    });

    // enter EMS code
    await page.type("#TextBarcode", emsid);

    // move the slider
    const e = await page.$('.bgSlider');
    const box = await e.boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width, box.y + 5); // slide
    await page.mouse.up();

    // wait for page to reloadÎ
    await page.waitForNavigation();

    // Read HTMl table to array
    const data = await page.evaluate(() => {
      const tds = Array.from(document.querySelectorAll("#DataGrid1"));
      return tds.map(td => td.innerText.trim());
    });
    
    if(data==null || data.length < 1) {
      result['success'] = false;
      res.status(404);
    } else {
    
      // Modify output format
      data[0] = data[0].replace(/\t/g, ' ');
      var tracking = data[0].split("\n");
      tracking.shift(); // remove วันที่ / เวลา หน่วยงาน  คำอธิบาย  ผลการนำจ่าย
      var status = [];
      // combine 2 element(date and status) into 1 element
      // จันทร์ 23 กรกฎาคม 2561 
      // 18:02:14 น. สำเหร่  รับเข้าระบบ   
      
      for (var i = 0; i + 1 <= tracking.length; i += 2) {
        temp = tracking[i + 1].split(" "); // 18:02:14 น. สำเหร่  รับเข้าระบบ   
        temp[3] = "=> " + temp[3].trim(); // change สำเหร่  รับเข้าระบบ to  สำเหร่ => รับเข้าระบบ
        tracking[i + 1] = temp.join(" ");
        if(i+1 == tracking.length-1)
          tracking[i + 1] = tracking[i + 1].replace(' ชื่อผู้รับ', '');
        status.push(tracking[i] + tracking[i + 1]);
      }
      result['data'] = status;
    }
    logger(`Found the emsid:  ${result['success']}`);
    res.send(result);
    await browser.close();
  })();
});

const logger = (msg) => {
  let d = new Date();
  let tpday = [
    d.getFullYear(),
    ('0' + (d.getMonth() + 1)).slice(-2),
    ('0' + d.getDate()).slice(-2),
    ('0' + d.getHours()).slice(-2),
    ('0' + d.getSeconds()).slice(-2),
  ].join('-');
  console.log(`[${tpday}] => ${msg}`);
}

app.listen(port, () => console.log(`EMS Server app is listening on port ${port}`))