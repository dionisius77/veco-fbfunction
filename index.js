const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

exports.broadcastJadwalFromDataKelas = functions.firestore.document('/datakelas/{datakelasid}') //give your database path instead here
  .onUpdate(async (snapshot, context) => {
    const dataBefore = snapshot.before.data();
    const dataAfter = snapshot.after.data();
    let tokens = [];
    // let emails = [];
    if (dataAfter.jadwal && dataAfter.jadwal !== dataBefore.jadwal) {
      const currentDate = new Date();
      const dataSiswa = await db.collection('datasiswa').where('kelas', '==', snapshot.after.id).get();
      const promises = [];
      dataSiswa.forEach(async (doc) => {
        let userData = db.collection('user').doc(doc.data().kontak.email).get();
        promises.push(userData);
        let dataNotif = {
          notifId: 11,
          title: 'Jadwal',
          message: `Jadwal ${snapshot.after.id} telah terbit`,
          hasAction: true,
          opened: false,
          createdAt: admin.firestore.Timestamp.fromDate(currentDate),
          for: doc.data().kontak.email,
        }

        await db.collection('notification').add(dataNotif);
        // emails.push(doc.data().kontak.email);
      });
      Promise.all(promises).then(async val => {
        val.forEach(e => {
          if (e.data().token) {
            tokens.push(e.data().token);
          }
        });
        console.log('return promise: ', val);
        let message = {
          notification: {
            title: `Jadwal ${snapshot.after.id} telah terbit`,
            body: 'Buka aplikasi dan check jadwal',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          }
        };
        const result = await admin.messaging().sendToDevice(tokens, message);
        return result;
      }).catch(err => {
        console.log('error promise: ', err);
      })
    } else {
      console.log(`there's no change at firestore /datakelas/{${snapshot.before.id}}`);
      return null;
    }
  });

exports.getJadwalFromFLutter = functions.https.onCall(async (data, context) => {
  const siswa = await db.collection('datasiswa').doc(data.nik).get();
  let listStaff = {};

  if (siswa.data().kelas !== '') {
    const staff = await db.collection('datastaff').get();
    staff.forEach(doc => {
      listStaff[doc.id] = doc.data().nama;
    });

    const getNamaStafff = (id) => {
      return listStaff[id];
    }
    const generateJadwal = (obj) => {
      let jadwalForFlutter = {
        senin: [],
        selasa: [],
        rabu: [],
        kamis: [],
        jumat: []
      };
      return new Promise((resolve, reject) => {
        for (let prop in obj) {
          let splitted = prop.split('-');
          const splittedId = (obj[prop].id).split('_');
          jadwalForFlutter[splitted[0]][parseInt(splitted[1]) - 1] = {
            matapelajaran: obj[prop].text,
            guru: getNamaStafff(splittedId[1])
          };
        }
        resolve(jadwalForFlutter);
      });
    }
    const kelas = await db.collection('datakelas').doc(siswa.data().kelas).get();
    if (kelas.data().jadwal !== undefined) {
      let rawJadwal = kelas.data().jadwal;
      const jadwalForFlutter = await generateJadwal(rawJadwal).then(res => {
        return res;
      });
      return { jadwal: jadwalForFlutter };
    } else {
      console.log('jadwal belum di buat');
      return { jadwal: null };
    }
  } else {
    console.log('jadwal belum di buat');
    return { jadwal: null };
  }
});

exports.broadcastJadwalKBM = functions.firestore.document('/jadwalkbm/{jadwalid}') //give your database path instead here
  .onCreate(async (snapshot, context) => {
    const currentDate = new Date();
    const splitted = (snapshot.data().kelas).split('_');
    const dataSiswa = await db.collection('datasiswa').where('kelas', '==', splitted[1]).get();
    const promises = [];
    const message = `Jadwal ${snapshot.data().jenis} ${splitted[0]} ${snapshot.data().jenis === 'Tugas' ? 'dikumpulkan' : 'dilaksanakan'} pada tanggal ${snapshot.data().end}`
    dataSiswa.forEach(async (doc) => {
      let userData = db.collection('user').doc(doc.data().kontak.email).get();
      promises.push(userData);
      let dataNotif = {
        notifId: 12,
        title: `Jadwal ${snapshot.data().jenis}`,
        message: message,
        hasAction: true,
        opened: false,
        createdAt: admin.firestore.Timestamp.fromDate(currentDate),
        for: doc.data().kontak.email,
      }

      await db.collection('notification').add(dataNotif);
      // emails.push(doc.data().kontak.email);
    });
    Promise.all(promises).then(async val => {
      val.forEach(e => {
        tokens.push(e.data().token);
      });
      console.log('return promise: ', val);
      let message = {
        notification: {
          title: `Jadwal ${snapshot.data().jenis}`,
          body: message,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        }
      };
      const result = await admin.messaging().sendToDevice(tokens, message);
      return result;
    }).catch(err => {
      console.log('error promise: ', err);
    })
  });

exports.broadcastAbsensi = functions.firestore.document('absensi/{absensiid}/{kelasid}/{mapelid}')
  .onCreate(async (snapshot, context) => {
    let promises = [];
    let promisesNotif = [];
    let tokens = [];
    snapshot.data().absensi.forEach(siswa => {
      console.log('id siswa : ', siswa.id);
      if (!siswa.checked) {
        let userData = db.collection('user').where('nikSiswa', "==", siswa.id).where('role', "==", 'parent').get();
        promises.push(userData);
      }
    });

    let p1 = Promise.all(promises);
    p1.then(val => {
      val.forEach(docs => {
        docs.forEach(doc => {
          console.log('in foreach : ', doc.data());
          if (doc.data().token) {
            tokens.push(e.data().token);
            let dataNotif = {
              notifId: 21,
              title: `Absensi mata pelajaran ${snapshot.id}`,
              message: `Anak anda tidak hadir`,
              hasAction: true,
              opened: false,
              createdAt: admin.firestore.Timestamp.fromDate(currentDate),
              for: e.data().email,
            }

            promisesNotif.push(db.collection('notification').add(dataNotif));
          }
        });
      });
      return 'promise 1';

      // if(tokens.length > 0){
      //   const result = await admin.messaging().sendToDevice(tokens, message);
      //   return result;
      // } else {
      //   console.error('no registered devices');
      // }
    }, (err) => {
      console.log('rejected p1 : ', err);
    }).catch(error => {
      console.log('error promise 1 : ', error);
    })
    let p2 = Promise.all(promisesNotif);
    p2.then(val => {
      let message = {
        notification: {
          title: `Absensi mata pelajaran ${snapshot.id}`,
          body: 'Anak anda tidak hadir',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        }
      };
      admin.messaging().sendToDevice(tokens, message);
      return 'promise 2';
    }, (err) => {
      console.log('rejected p2 : ', err);
    }).catch(error => {
      console.log('error promise 2 : ', error);
    })
  });

exports.getKBMFromFLutter = functions.https.onCall(async (data, context) => {
  const groupingKBMByDate = (list) => {
    return new Promise((resolve, reject) => {
      let KBM = {};
      for (let docs of list.docs) {
        let mapelAndKelas = docs.data().kelas.split('_');
        if (KBM[docs.data().end]) {
          KBM[docs.data().end].push({
            "name": `${docs.data().jenis} ${mapelAndKelas[0]} ${docs.data().title}`,
            "isDone": false,
          });
        } else {
          KBM[docs.data().end] = [{
            "name": `${docs.data().jenis} ${mapelAndKelas[0]} ${docs.data().title}`,
            "isDone": false,
          }];
        }
      }
      resolve(KBM);
    });
  }
  const siswa = await db.collection('datasiswa').doc(data.nik).get();
  if (siswa.data().kelas !== '') {
    const currentDate = new Date();
    let year = currentDate.getFullYear();
    let month = currentDate.getMonth() < 10 ? `0${currentDate.getMonth() + 1}` : currentDate.getMonth() + 1;
    let tgl = currentDate.getDate() < 10 ? `0${currentDate.getDate()}` : currentDate.getDate();
    let formatedDate = year + "-" + month + "-" + tgl;
    const listKBM = await db.collection('jadwalkbm')
      .where('rawKelas', '==', siswa.data().kelas)
      .where('end', '>=', formatedDate).get();
    if (listKBM.size > 0) {
      const groupedListKBM = await groupingKBMByDate(listKBM);
      return {
        listKBM: groupedListKBM,
        isExists: true,
        hasAssigned: true,
      }
    } else {
      return {
        listKBM: null,
        isExists: false,
        hasAssigned: true,
        message: 'Belum ada jadwal kegiatan belajar mengajar',
      }
    }
  } else {
    return {
      listKBM: null,
      isExists: false,
      hasAssigned: false,
      message: 'Belum terdaftar dalam kelas',
    }
  }
});

exports.broadcastNilai = functions.firestore.document('nilai/{nilaiid}')
  .onCreate(async (snapshot, context) => {
    let promises = [];
    const currentDate = new Date();
    snapshot.data().nilai.forEach(docNilai => {
      promises.push(
        db.collection('datasiswa').doc(docNilai.id)
          .collection('nilai').doc(snapshot.data().kelas)
          .collection(snapshot.data().mataPelajaran).doc(snapshot.id)
          .create({
            title: snapshot.data().title,
            kegiatan: snapshot.data().kegiatan,
            nilai: docNilai.nilai,
            createdAt: admin.firestore.Timestamp.fromDate(currentDate),
          })
      );
      promises.push(
        db.collection('user').where('nik', '==', docNilai.id).get()
      )
      promises.push(
        db.collection('user').where('nikSiswa', '==', docNilai.id).get()
      )
    });

    let returned = await Promise.all(promises).then(async res => {
      let promisesNotif = [];
      res.forEach(async val => {
        if (val.size && val.size > 0) {
          let message = val.docs[0].data().role === 'parent'
            ?
            `${snapshot.data().kegiatan} ${snapshot.data().mataPelajaran} anak Anda sudah dinilai`
            :
            `Yeay ${snapshot.data().kegiatan} ${snapshot.data().mataPelajaran} Kamu sudah di nilai loh`
          promisesNotif.push(db.collection('notification').add({
            notifId: 13,
            title: `Nilai ${snapshot.data().kegiatan}`,
            message: message,
            hasAction: true,
            opened: false,
            createdAt: admin.firestore.Timestamp.fromDate(currentDate),
            for: val.docs[0].data().email,
          }));
          if (val.docs[0].data().token) {
            await admin.messaging().sendToDevice([val.docs[0].data().token], {
              notification: {
                title: `Hi${val.docs[0].data().role === 'parent' ? ' Parents' : ''}, yuk lihat nilai [nama anak]`,
                body: `Lihat sekarang yuk di aplikasinya!`,
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
              }
            });
          }
        }
      });

      return promisesNotif;
    }).then(data => {
      console.log(data);
      return '';
      // Promise.all(data)
    }).catch(err => {
      console.error('error : ', err);
      return `error : ${err}`;
    });

    return returned;
  });

exports.getNilaiFromFlutter = functions.https.onCall(async (data, context) => {
  const generateList = (rawList) => {
    return new Promise((resolve, reject) => {
      let list = [];
      rawList.forEach(doc => {
        list.push({
          kegiatan: doc.data().kegiatan,
          nilai: doc.data().nilai,
          title: doc.data().title,
        });
      });
      resolve(list);
    });
  }

  const rawNilai = await db.collection('datasiswa').doc(data.nik)
    .collection('nilai').doc(data.kelas)
    .collection(data.mataPelajaran).orderBy('createdAt', 'desc').get();

  if (rawNilai.size > 0) {
    const listNilai = await generateList(rawNilai.docs);
    return {
      listNilai: listNilai,
      isExists: true,
      message: 'Sudah ada beberapa nilai.',
    }
  } else {
    return {
      listNilai: null,
      isExists: false,
      message: 'Sepertinya belum ada nilai yang di input, harap bersabar ya.',
    }
  }
});

exports.getListMapelFromFlutter = functions.https.onCall(async (data, context) => {
  const generateListMapel = (rawData) => {
    return new Promise((resolve, reject) => {
      let list = [];
      rawData.forEach(doc => {
        list.push(doc.data().matapelajaran);
      });
      resolve(list);
    });
  }

  const dataSiswa = await db.collection('datasiswa').doc(data.nik).get();
  if(dataSiswa.data().kelas !== ''){
    const dataMapel = await db.collection('datakelas').doc(dataSiswa.data().kelas)
      .collection('matapelajaran').get();
    if(dataMapel.size > 0){
      const listMapel = await generateListMapel(dataMapel.docs);
      return {
        listMapel: listMapel,
        kelas: dataSiswa.data().kelas,
        isExists: true,
        message: 'List mata pelajaran sudah ada',
      }
    } else {
      return {
        listMapel: null,
        isExists: false,
        message: 'Semangat banget ya, kegiatan belajar mengajar belum di mulai loh.',
      }
    }
  } else {
    return {
      listMapel: null,
      isExists: false,
      message: 'Kamu belum terdaftar dalam kelas manapun.',
    }
  }
});