-- Imports public, read-only RC manuals from the supplied JSON catalog.
-- Safe to rerun: entries whose manual_url already exists are skipped.
begin;

alter table public.manuals alter column user_id drop not null;

insert into public.manuals (user_id, title, cover_url, manual_url)
select null, seed.title, seed.cover_url, seed.manual_url
from (values
  ('Traxxas X-Maxx 8S (77086-4)', 'https://images.amainhobbies.com/images/large/tra/tra77086-4-grn.jpg', 'https://www.rmv-deutschland.de/media/hcdownloads/file/x/-/X-Maxx-8s-77086-4-Front-Assembly.pdf'),
  ('Traxxas Maxx (89086-4)', 'https://images.amainhobbies.com/images/large/tra/tra89086-4-ylw.jpg', 'https://www.gearrc.com/pdfmanual/89086-4maxxv2.pdf'),
  ('Traxxas Slash 4×4 VXL (68086-4)', 'https://images.amainhobbies.com/images/large/tra/tra68086-4-visn.jpg', 'https://www.gearrc.com/pdfmanual/TRX68086-4slash4x4vxl.pdf'),
  ('Traxxas TRX-4 Defender（无车壳卡扣版） (82256-4)', 'https://images.amainhobbies.com/images/large/tra/tra82256-4-sand.jpg', 'https://www.trx4.de/downloads/82256-4-TRX4Defender.pdf'),
  ('Traxxas TRX-4M Defender (97054-1)', 'https://images.amainhobbies.com/images/large/tra/tra97054-1-blue.jpg', 'https://manuals.plus/m/33291e626b76cf62bffc678415e0a9b59ac09412bd08303da02525877b223739.pdf'),
  ('Traxxas XRT (78086-4)', 'https://images.amainhobbies.com/images/large/tra/tra78086-4-blk.jpg', 'https://www.rmv-deutschland.de/media/hcdownloads/file/x/r/XRT_78086-4_Chassis_Assembly_Exploded_View_Traxxas.pdf'),
  ('Traxxas Rustler 4×4 VXL (67076-4)', 'https://images.amainhobbies.com/images/large/tra/tra67076-4-pink.jpg', 'https://www.der-getriebedoktor.de/man/man71335_chassis.pdf'),
  ('Traxxas Stampede 4×4（有刷版） (67054-1)', 'https://images.amainhobbies.com/images/large/tra/tra67054-1-red.jpg', 'https://www.der-getriebedoktor.de/man/man71438_ex5.pdf'),
  ('Traxxas Unlimited Desert Racer（UDR） (85076-4)', 'https://images.amainhobbies.com/images/large/tra/tra85076-4-fox.jpg', 'https://www.gearrc.com/pdfmanual/85076-4desert.pdf'),
  ('Traxxas Sledge (95076-4)', 'https://images.amainhobbies.com/images/large/tra/tra95076-4-blue.jpg', 'https://www.der-getriebedoktor.de/man/man71439_ex1.pdf'),
  ('ARRMA KRATON 6S BLX V6 (ARA8608V6)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw40410ddf/Images/ARA/ARA8608V6_A0_05PTCK3T.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA8608V6_PARTS_TECH_PACK_ML.pdf'),
  ('ARRMA TYPHON 6S BLX V5 (ARA8606V5)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw09ca1eb0/Images/ARA/ARA8606V5_A00_UIRS6W20.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA8606V5-Exploded_View.pdf'),
  ('ARRMA MOJAVE 6S BLX V2 (ARA7604V2)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw88707aea/Images/ARA/ARA7604V2_A00_0W00K0IO.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA7604V2-Exploded_View.pdf'),
  ('ARRMA INFRACTION 6S BLX（初代） (ARA109001)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw9bc933b3/Images/ARA/ARA109001_A0_51QHUIDL.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA109001-Exploded-View-MULTI.pdf'),
  ('ARRMA FELONY 6S BLX (ARA7617V2)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwb3ad9d03/Images/ARA/ARA7617V2_A00_HXFUGCYH.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA7617V2-Exploded-View-MULTI.pdf'),
  ('ARRMA NOTORIOUS 6S BLX V5 (ARA8611V5)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw23b5979d/Images/ARA/ARA8611V5_A00_2HEGHRFO.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA8611V5-Exploded_View.pdf'),
  ('ARRMA OUTCAST 8S BLX (ARA5810)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw4292c99e/Images/ARA/ARA5810_A0_1PEKZ2MJ.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA5810-Parts_Explosion_MULTI.pdf'),
  ('ARRMA BIG ROCK 3S BLX V3 (ARA4312V3)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwe7dc44af/Images/ARA/ARA4312V3_A0_HRDN0DBI.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA4312V3-Exploded-View-MULTI.pdf'),
  ('ARRMA SENTON 223S DSC V4 (ARA4303V4)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwe0a4e8ac/Images/ARA/ARA4303V4_A0_9S75L33T.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA4303V4_PARTS_TECH_PACK_ML.pdf'),
  ('ARRMA GRANITE 3S BLX V3 (ARA4302V3)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwaaea283c/Images/ARA/ARA4302V3_A0_MEU77BNV.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/ARA4302V3-exploded-view.pdf'),
  ('Losi Promoto-MX (LOS06000)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwec7e6b36/Images/LOS/LOS06000_A2_6PJ25Q8F.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dwf5e43c1e/Manuals/LOS06000_MANUAL_EN.pdf'),
  ('Losi LMT (LOS04021)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw2a38e90b/Images/LOS/LOS04021_A00_9MIJNT16.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/LOS04021-Manual-EN.pdf'),
  ('Losi Mini LMT Megalodon (LOS01026T3)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw5a1e506f/Images/LOS/LOS01026T3_A93_FYRNP73P.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dwb32460d5/Manuals/LOS01026T3_EXPLODED_VIEW.pdf'),
  ('Losi Mini-B（有刷版） (LOS01016)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw2ab99676/Images/LOS/LOS01016_A00_XAVNCJ10.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dw1e9baebe/Manuals/LOS01016-Manual-EN.pdf'),
  ('Losi Mini-T 2.0（无刷版） (LOS01019)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwe26cf693/Images/LOS/LOS01019_A00_62NWR2XA.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dwb2de0205/Manuals/LOS01019-Manual-EN.pdf'),
  ('Losi Micro-B (LOS00007)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwae7acbaa/Images/LOS/LOS00007_A00_904P3MKZ.jpg', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw7e7ff009/Manuals/LOS00007_EXPLODED_VIEW_ML.pdf'),
  ('Losi Baja Rey 2.0 Ford Raptor (LOS03046)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw2e1f2872/Images/LOS/LOS03046_A0_5JZ9A11O.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dwc7ece5e5/Manuals/LOS03046_EXPLODED_VIEW_MULTI.pdf'),
  ('Losi Super Baja Rey 2.0 (LOS05021)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw068e0eae/Images/LOS/LOS05021_A00_6W9BRDXA.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dwea28d948/Manuals/LOS05021-Exploded-View.pdf'),
  ('Losi TENACITY DB Pro (LOS03027)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw58aaae5c/Images/LOS/LOS03027_A0_66D5JV38.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dw7800e33f/Manuals/LOS03027-Manual-EN.pdf'),
  ('Losi 22S ’69 Camaro Drag (LOS03035)', 'https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dw9628bae8/Images/LOS/LOS03035_A0_00LGNUO5.jpg', 'https://www.losi.com/on/demandware.static/-/Sites-horizon-master/default/dwdc37d696/Manuals/LOS03035-Exploded_View-MULTI.pdf')
) as seed(title, cover_url, manual_url)
where not exists (
  select 1 from public.manuals existing where existing.manual_url = seed.manual_url
);

commit;
