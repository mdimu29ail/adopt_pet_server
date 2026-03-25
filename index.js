import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ✅ ১. Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ ২. Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
// এখানে ANON_KEY এর বদলে SERVICE_ROLE_KEY ব্যবহার করুন
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const port = process.env.PORT || 5000;

// ✅ ৩. Middleware
app.use(
  cors({
    origin: 'https://adopt-pet-client.vercel.app',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// --- 🛡️ ৪. Auth Middlewares (Supabase Version) ---

// ইউজারের টোকেন ভেরিফাই করার জন্য
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = authHeader.split(' ')[1];

  // Supabase Auth দিয়ে টোকেন চেক করা
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(403).send({ message: 'Forbidden access' });
  }

  req.user = user; // ইউজারের ইমেইল এবং আইডি এখানে থাকবে
  next();
};

// অ্যাডমিন চেক করার জন্য
const verifyAdmin = async (req, res, next) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ message: 'Unauthorized' });

  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('email', email)
    .single();

  if (error || !user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  next();
};

// ------------------------ ৫. USERS ROUTES ------------------------

// সব ইউজারদের লিস্ট পাওয়া (Admin Only)
app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return res.status(400).send(error);
  res.send(data);
});

// ইউজার সার্চ করা (Admin Only)
app.get('/users/search', verifyJWT, verifyAdmin, async (req, res) => {
  const email = req.query.email || '';
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', `%${email}%`);
  res.send(data || []);
});

// নতুন ইউজার ডাটাবেজে সেভ করা (Registration/Login এর পর)
app.post('/users', async (req, res) => {
  const { email, name, image } = req.body;
  if (!email) return res.status(400).send({ message: 'Email required' });

  const { data: exists } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (exists)
    return res.send({ message: 'User already exists', inserted: false });

  const { data, error } = await supabase
    .from('users')
    .insert([{ email, name, image, role: 'user' }])
    .select();
  res.send({ inserted: true, data: data?.[0] });
});

// ইউজারের রোল আপডেট (Admin Only)
app.patch('/users/role', verifyJWT, verifyAdmin, async (req, res) => {
  const { email, role } = req.body;
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('email', email);
  res.send({ success: !error });
});

// ইউজারের রোল চেক করা

app.get('/users/role/:email', async (req, res) => {
  const { email } = req.params;
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('email', email)
    .single();

  if (error) {
    // এটি আপনাকে জানাবে ডাটাবেস থেকে কোনো এরর আসছে কি না
    return res.status(400).send({ role: 'error', message: error.message });
  }

  if (!data) {
    return res.send({ role: 'not_found' });
  }

  res.send({ role: data.role });
});
// ------------------------ ৬. PETS ROUTES ------------------------

app.get('/pets', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 100;
  const { data } = await supabase
    .from('pets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  res.send(data || []);
});

app.post('/pets', verifyJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('pets')
    .insert([{ ...req.body, created_at: new Date() }])
    .select();
  if (error) return res.status(400).send(error);
  res.status(201).send({ insertedId: data[0].id });
});

app.get('/pets/:id', async (req, res) => {
  const { data } = await supabase
    .from('pets')
    .select('*')
    .eq('id', req.params.id)
    .single();
  res.send(data);
});

app.put('/pets/:id', verifyJWT, async (req, res) => {
  const { error } = await supabase
    .from('pets')
    .update(req.body)
    .eq('id', req.params.id);
  res.send({ success: !error });
});

app.delete('/pets/:id', verifyJWT, async (req, res) => {
  const { error } = await supabase
    .from('pets')
    .delete()
    .eq('id', req.params.id);
  res.send({ success: !error });
});
// index.js (Backend)
app.delete('/pets/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('pets').delete().eq('id', id);

    if (error) {
      return res.status(400).send({ success: false, message: error.message });
    }
    res.send({ success: true, message: 'Pet deleted successfully' });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});
// ------------------------ ৭. ADOPTIONS ROUTES ------------------------
// ১. সব ইভেন্ট গেট করা (পাবলিক)

/**
 * --- EVENTS API ---
 */

// ১. সব ইভেন্ট গেট করা (পাবলিক)
app.get('/events', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    res.send(data);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// ২. নির্দিষ্ট একটি ইভেন্ট আইডি দিয়ে গেট করা (সাথে বুকড সিট কাউন্ট)
// নোট: এটি ডুপ্লিকেট রুট সমস্যা সমাধান করে এবং রিয়েল-টাইম কাউন্ট পাঠায়
app.get('/events/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // ইভেন্টের বিস্তারিত তথ্য আনা
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError) throw eventError;

    // বুকড সিট কাউন্ট রিয়েল-টাইম গণনা করা
    const { count, error: countError } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id);

    if (countError) throw countError;

    // ইভেন্ট ডাটার সাথে কাউন্ট মার্জ করে পাঠানো
    res.send({
      ...event,
      registeredCount: count || 0,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ৩. নতুন ইভেন্ট অ্যাড করা (Admin Only)
app.post('/events', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert([req.body])
      .select();

    if (error) throw error;
    res.status(201).send({ success: true, data: data[0] });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// ৪. আপডেট ইভেন্ট (Admin Only)
app.patch('/events/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('events')
      .update(req.body)
      .eq('id', id);

    if (error) throw error;
    res.send({ success: true, message: 'Event updated successfully' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// ৫. ডিলিট ইভেন্ট (Admin Only)
app.delete('/events/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('events').delete().eq('id', id);

    if (error) throw error;
    res.send({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

/**

 * ---  ইভেন্ট  ---
 */

// ৬. ইভেন্ট রেজিস্ট্রেশন করা
app.post('/event-registrations', verifyJWT, async (req, res) => {
  const registrationData = req.body;

  try {
    // চেক করা ইউজার আগে রেজিস্ট্রেশন করেছে কি না
    const { data: existing } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', registrationData.event_id)
      .eq('user_email', registrationData.user_email)
      .single();

    if (existing) {
      return res.status(400).send({
        success: false,
        message: 'You have already registered for this event!',
      });
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .insert([registrationData])
      .select();

    if (error) throw error;
    res.send({ success: true, message: 'Registration Successful!' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// ৭. ইউজার রেজিস্ট্রেশন করেছে কি না চেক করা (বাটন স্ট্যাটাস এর জন্য)
app.get('/event-registrations/check', verifyJWT, async (req, res) => {
  const { event_id, email } = req.query;
  try {
    const { data } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', event_id)
      .eq('user_email', email)
      .single();

    res.send({ isRegistered: !!data });
  } catch (err) {
    res.send({ isRegistered: false });
  }
});
//////////////////////////////////////////
// ব্লগ পোস্ট করার রুট

// ১. সব ব্লগ ডাটাবেস থেকে পাওয়া (Latest First)
app.get('/blogs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('blogs') // নিশ্চিত হোন আপনার সুপাবেস টেবিলের নাম 'blogs'
      .select('*')
      .order('created_at', { ascending: false }); // নতুন ব্লগগুলো আগে দেখাবে

    if (error) throw error;
    res.send(data);
  } catch (err) {
    res.status(400).send({ success: false, message: err.message });
  }
});

// ২. নির্দিষ্ট একটি ব্লগের ডিটেইলস পাওয়া (ID দিয়ে)
app.get('/blogs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', id)
      .single(); // একটি মাত্র ডাটা রিটার্ন করবে

    if (error) throw error;
    res.send(data);
  } catch (err) {
    res.status(400).send({ success: false, message: 'Blog not found!' });
  }
});
app.post('/blogs', verifyJWT, verifyAdmin, async (req, res) => {
  const blogData = req.body;

  try {
    const { data, error } = await supabase
      .from('blogs') // নিশ্চিত হোন টেবিলের নাম 'blogs'
      .insert([blogData])
      .select();

    if (error) throw error;

    res.status(201).send({ success: true, data: data[0] });
  } catch (error) {
    console.error('Supabase Error:', error.message);
    res.status(400).send({ success: false, message: error.message });
  }
});

// ১. আপডেট ব্লগ (Admin Only)
app.patch('/blogs/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('blogs')
      .update(req.body)
      .eq('id', id);
    if (error) throw error;
    res.send({ success: true, message: 'Blog updated successfully' });
  } catch (err) {
    res.status(400).send({ success: false, message: err.message });
  }
});

// ২. ডিলিট ব্লগ (Admin Only)
app.delete('/blogs/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('blogs').delete().eq('id', id);
    if (error) throw error;
    res.send({ success: true, message: 'Blog deleted successfully' });
  } catch (err) {
    res.status(400).send({ success: false, message: err.message });
  }
});

// ==========================================
// 🐶 ADOPTION STATUS UPDATE & DELETE ROUTES
// ==========================================

// ১. রিকোয়েস্ট অ্যাকসেপ্ট (Approve) করার রাউট
app.patch('/adoptions/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await supabase
      .from('adoptions')
      .update({ status: status }) // স্ট্যাটাস আপডেট হবে (যেমন: 'Accepted')
      .eq('id', id) // সুপাবেসের 'id' কলাম চেক করবে
      .select();

    if (error) {
      console.error('❌ Supabase Update Error:', error.message);
      return res.status(400).send({ success: false, message: error.message });
    }

    res.send({ success: true, data });
  } catch (err) {
    console.error('❌ Server Error:', err);
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

// ২. রিকোয়েস্ট রিজেক্ট/ডিলিট করার রাউট
app.delete('/adoptions/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('adoptions').delete().eq('id', id);

    if (error) {
      console.error('❌ Supabase Delete Error:', error.message);
      return res.status(400).send({ success: false, message: error.message });
    }

    res.send({
      success: true,
      message: 'Adoption request deleted successfully',
    });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});
// index.js (Backend) এ এটি নিশ্চিত করুন
app.post('/adoptions', verifyJWT, async (req, res) => {
  const adoptionData = req.body;

  try {
    const { data, error } = await supabase
      .from('adoptions')
      .insert([adoptionData])
      .select();

    if (error) {
      console.error('Supabase Insert Error:', error.message);
      return res.status(400).send({ message: error.message });
    }

    // સુপাবেস 'data' অ্যারে রিটার্ন করে
    res.status(201).send({ success: true, insertedId: data[0].id });
  } catch (err) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.get('/adoptions', verifyJWT, async (req, res) => {
  const email = req.query.email;
  let query = supabase.from('adoptions').select('*, pets(*)');
  if (email) query = query.eq('user_email', email);
  const { data } = await query;
  res.send(data || []);
});
// Status Update Route
app.patch('/adoptions/:id/status', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { error } = await supabase
    .from('adoptions')
    .update({ status })
    .eq('id', id);
  if (error)
    return res.status(400).send({ success: false, message: error.message });
  res.send({ success: true, modified: true });
});

// // Delete Route
// app.delete('/adoptions/:id', verifyJWT, async (req, res) => {
//   const { error } = await supabase
//     .from('adoptions')
//     .delete()
//     .eq('id', req.params.id);
//   if (error) return res.status(400).send({ success: false });
//   res.send({ success: true });
// });
// ------------------------ ৮. CAMPAIGNS ROUTES ------------------------

app.get('/campaigns', async (req, res) => {
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  res.send(data || []);
});

app.post('/campaigns', async (req, res) => {
  const campaignData = req.body;

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignData])
      .select();

    if (error) {
      console.error('Supabase Error:', error);
      return res.status(400).send({ message: error.message });
    }

    res.status(201).send({ insertedId: data[0].id });
  } catch (err) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
// index.js (Backend)
app.delete('/campaigns/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('campaigns').delete().eq('id', id); // সুপাবেসে 'id' কলাম চেক করবে

    if (error) {
      console.error('Supabase Delete Error:', error);
      return res.status(400).send({ message: error.message });
    }

    res.send({ success: true, message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// index.js (Backend)
app.get('/campaigns/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id) // এখানে '_id' এর বদলে 'id' হবে
      .single();

    if (error) {
      console.error('Supabase Error:', error.message);
      return res.status(404).send({ message: 'Campaign not found' });
    }

    res.send(data);
  } catch (err) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// index.js (Backend) এ এটি নিশ্চিত করুন
app.patch('/campaigns/:id', verifyJWT, async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updatedData)
      .eq('id', id) // সুপাবেসে 'id' কলাম চেক করবে
      .select();

    if (error) {
      console.error('Supabase Patch Error:', error.message);
      return res.status(400).send({ success: false, message: error.message });
    }

    res.send({ success: true, modifiedCount: data.length });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

// ------------------------ ৯. STRIPE & DONATIONS ------------------------

// index.js (Backend)
app.get('/payments', verifyJWT, async (req, res) => {
  const { email } = req.query;

  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('email', email)
      .order('paid_at', { ascending: false });

    if (error) throw error;
    res.send(data);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});
app.post('/create-payment-intent', verifyJWT, async (req, res) => {
  const { amountInCents } = req.body; // নিশ্চিত করুন এখানে নাম 'amountInCents'
  if (!amountInCents)
    return res.status(400).send({ message: 'Amount required' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card'],
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

app.post('/payments', verifyJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .insert([{ ...req.body, paid_at: new Date() }])
    .select();
  if (error) return res.status(400).send(error);
  res.status(201).send({ insertedId: data?.[0]?.id });
});

// ------------------------ ১০. STATS ------------------------

app.get('/admin/total-donations', verifyJWT, verifyAdmin, async (req, res) => {
  const { data } = await supabase.from('payments').select('amount');
  const total = data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
  res.send({ total, count: data?.length || 0 });
});

// Health Check
app.get('/', (req, res) =>
  res.send('🐶 Pet Adoption Pure Supabase Server is running'),
);

app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
