// import 'dotenv/config';
// import express from 'express';
// import cors from 'cors';
// import cookieParser from 'cookie-parser';
// import Stripe from 'stripe';
// import { createClient } from '@supabase/supabase-js';

// // ✅ ১. Initialize Stripe
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// // ✅ ২. Initialize Supabase
// const supabaseUrl = process.env.SUPABASE_URL;
// // এখানে ANON_KEY এর বদলে SERVICE_ROLE_KEY ব্যবহার করুন
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// const supabase = createClient(supabaseUrl, supabaseKey);

// const app = express();
// const port = process.env.PORT || 5000;

// // ✅ ৩. Middleware
// app.use(
//   cors({
//     origin: ['https://adopt-pet-client.vercel.app', 'http://localhost:5173'],
//     credentials: true,
//   })
// );
// app.use(express.json());
// app.use(cookieParser());

// // --- 🛡️ ৪. Auth Middlewares (Supabase Version) ---

// // ইউজারের টোকেন ভেরিফাই করার জন্য
// const verifyJWT = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).send({ message: 'Unauthorized access' });
//   }

//   const token = authHeader.split(' ')[1];

//   // Supabase Auth দিয়ে টোকেন চেক করা
//   const {
//     data: { user },
//     error,
//   } = await supabase.auth.getUser(token);

//   if (error || !user) {
//     return res.status(403).send({ message: 'Forbidden access' });
//   }

//   req.user = user; // ইউজারের ইমেইল এবং আইডি এখানে থাকবে
//   next();
// };

// // অ্যাডমিন চেক করার জন্য
// const verifyAdmin = async (req, res, next) => {
//   const email = req.user?.email;
//   if (!email) return res.status(401).json({ message: 'Unauthorized' });

//   const { data: user, error } = await supabase
//     .from('users')
//     .select('role')
//     .eq('email', email)
//     .single();

//   if (error || !user || user.role !== 'admin') {
//     return res.status(403).json({ message: 'Forbidden: Admins only' });
//   }
//   next();
// };

// // ------------------------ ৫. USERS ROUTES ------------------------

// // সব ইউজারদের লিস্ট পাওয়া (Admin Only)
// app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
//   try {
//     const { data, error } = await supabase.from('users').select('*');
//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// // ইউজার সার্চ করা (Admin Only)
// app.get('/users/search', verifyJWT, verifyAdmin, async (req, res) => {
//   const email = req.query.email || '';
//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .select('*')
//       .ilike('email', `%${email}%`);
//     if (error) throw error;
//     res.send(data || []);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// // নতুন ইউজার ডাটাবেজে সেভ করা (Registration/Login এর পর)
// app.post('/users', async (req, res) => {
//   const { email, name, image } = req.body;
//   if (!email) return res.status(400).send({ message: 'Email required' });

//   try {
//     const { data: exists, error: checkError } = await supabase
//       .from('users')
//       .select('*')
//       .eq('email', email)
//       .single();
//     if (checkError && checkError.code !== 'PGRST116') throw checkError;
//     if (exists)
//       return res.send({ message: 'User already exists', inserted: false });

//     const { data, error } = await supabase
//       .from('users')
//       .insert([{ email, name, image, role: 'user' }])
//       .select();
//     if (error) throw error;
//     res.send({ inserted: true, data: data?.[0] });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// // ইউজারের রোল আপডেট (Admin Only)
// app.patch('/users/role', verifyJWT, verifyAdmin, async (req, res) => {
//   const { email, role } = req.body;
//   try {
//     const { error } = await supabase
//       .from('users')
//       .update({ role })
//       .eq('email', email);
//     if (error) throw error;
//     res.send({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// // ইউজারের রোল চেক করা
// app.get('/users/role/:email', async (req, res) => {
//   const { email } = req.params;
//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .select('role')
//       .eq('email', email)
//       .single();

//     if (error && error.code !== 'PGRST116') throw error;
//     if (!data) {
//       return res.send({ role: 'not_found' });
//     }
//     res.send({ role: data.role });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });
// // ------------------------ ৬. PETS ROUTES ------------------------

// app.get('/pets', async (req, res) => {
//   const limit = req.query.limit ? parseInt(req.query.limit) : 100;
//   try {
//     const { data, error } = await supabase
//       .from('pets')
//       .select('*')
//       .order('created_at', { ascending: false })
//       .limit(limit);
//     if (error) throw error;
//     res.send(data || []);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.post('/pets', verifyJWT, async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('pets')
//       .insert([{ ...req.body, created_at: new Date() }])
//       .select();
//     if (error) throw error;
//     res.status(201).send({ insertedId: data[0].id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.get('/pets/:id', async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('pets')
//       .select('*')
//       .eq('id', req.params.id)
//       .single();
//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.put('/pets/:id', verifyJWT, async (req, res) => {
//   try {
//     const { error } = await supabase
//       .from('pets')
//       .update(req.body)
//       .eq('id', req.params.id);
//     if (error) throw error;
//     res.send({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// // Combined Delete Pet Route
// app.delete('/pets/:id', verifyJWT, verifyAdmin, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase.from('pets').delete().eq('id', id);

//     if (error) throw error;
//     res.send({ success: true, message: 'Pet deleted successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// // ------------------------ ৭. ADOPTIONS ROUTES ------------------------
// app.get('/events', async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('events')
//       .select('*')
//       .order('date', { ascending: true });

//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.get('/events/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { data: event, error: eventError } = await supabase
//       .from('events')
//       .select('*')
//       .eq('id', id)
//       .single();

//     if (eventError) throw eventError;

//     const { count, error: countError } = await supabase
//       .from('event_registrations')
//       .select('*', { count: 'exact', head: true })
//       .eq('event_id', id);

//     if (countError) throw countError;

//     res.send({
//       ...event,
//       registeredCount: count || 0,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.post('/events', verifyJWT, verifyAdmin, async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('events')
//       .insert([req.body])
//       .select();

//     if (error) throw error;
//     res.status(201).send({ success: true, data: data[0] });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.patch('/events/:id', verifyJWT, verifyAdmin, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase
//       .from('events')
//       .update(req.body)
//       .eq('id', id);

//     if (error) throw error;
//     res.send({ success: true, message: 'Event updated successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.delete('/events/:id', verifyJWT, verifyAdmin, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase.from('events').delete().eq('id', id);

//     if (error) throw error;
//     res.send({ success: true, message: 'Event deleted successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.post('/event-registrations', verifyJWT, async (req, res) => {
//   const registrationData = req.body;
//   try {
//     const { data: existing, error: checkError } = await supabase
//       .from('event_registrations')
//       .select('*')
//       .eq('event_id', registrationData.event_id)
//       .eq('user_email', registrationData.user_email)
//       .single();

//     if (checkError && checkError.code !== 'PGRST116') throw checkError;
//     if (existing) {
//       return res.status(400).send({
//         success: false,
//         message: 'You have already registered for this event!',
//       });
//     }

//     const { data, error } = await supabase
//       .from('event_registrations')
//       .insert([registrationData])
//       .select();

//     if (error) throw error;
//     res.send({ success: true, message: 'Registration Successful!' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.get('/event-registrations/check', verifyJWT, async (req, res) => {
//   const { event_id, email } = req.query;
//   try {
//     const { data, error } = await supabase
//       .from('event_registrations')
//       .select('*')
//       .eq('event_id', event_id)
//       .eq('user_email', email)
//       .single();

//     if (error && error.code !== 'PGRST116') throw error;
//     res.send({ isRegistered: !!data });
//   } catch (err) {
//     console.error(err);
//     res.send({ isRegistered: false });
//   }
// });

// app.get('/blogs', async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('blogs')
//       .select('*')
//       .order('created_at', { ascending: false });

//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.get('/blogs/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { data, error } = await supabase
//       .from('blogs')
//       .select('*')
//       .eq('id', id)
//       .single();

//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Blog not found!' });
//   }
// });

// app.post('/blogs', verifyJWT, verifyAdmin, async (req, res) => {
//   const blogData = req.body;
//   try {
//     const { data, error } = await supabase
//       .from('blogs')
//       .insert([blogData])
//       .select();

//     if (error) throw error;
//     res.status(201).send({ success: true, data: data[0] });
//   } catch (error) {
//     console.error('Supabase Error:', error.message);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.patch('/blogs/:id', verifyJWT, verifyAdmin, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase
//       .from('blogs')
//       .update(req.body)
//       .eq('id', id);
//     if (error) throw error;
//     res.send({ success: true, message: 'Blog updated successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.delete('/blogs/:id', verifyJWT, verifyAdmin, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase.from('blogs').delete().eq('id', id);
//     if (error) throw error;
//     res.send({ success: true, message: 'Blog deleted successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.patch('/adoptions/:id', verifyJWT, async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;
//   try {
//     const { data, error } = await supabase
//       .from('adoptions')
//       .update({ status: status })
//       .eq('id', id)
//       .select();

//     if (error) throw error;
//     res.send({ success: true, data });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.delete('/adoptions/:id', verifyJWT, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase.from('adoptions').delete().eq('id', id);
//     if (error) throw error;
//     res.send({
//       success: true,
//       message: 'Adoption request deleted successfully',
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.post('/adoptions', verifyJWT, async (req, res) => {
//   const adoptionData = req.body;
//   try {
//     const { data, error } = await supabase
//       .from('adoptions')
//       .insert([adoptionData])
//       .select();

//     if (error) throw error;
//     res.status(201).send({ success: true, insertedId: data[0].id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.get('/adoptions', verifyJWT, async (req, res) => {
//   const email = req.query.email;
//   try {
//     let query = supabase.from('adoptions').select('*, pets(*)');
//     if (email) query = query.eq('user_email', email);
//     const { data, error } = await query;
//     if (error) throw error;
//     res.send(data || []);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.patch('/adoptions/:id/status', verifyJWT, async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;
//   try {
//     const { error } = await supabase
//       .from('adoptions')
//       .update({ status })
//       .eq('id', id);
//     if (error) throw error;
//     res.send({ success: true, modified: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.get('/campaigns', async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('campaigns')
//       .select('*')
//       .order('created_at', { ascending: false });
//     if (error) throw error;
//     res.send(data || []);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.post('/campaigns', async (req, res) => {
//   const campaignData = req.body;
//   try {
//     const { data, error } = await supabase
//       .from('campaigns')
//       .insert([campaignData])
//       .select();

//     if (error) throw error;
//     res.status(201).send({ insertedId: data[0].id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.delete('/campaigns/:id', verifyJWT, async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { error } = await supabase.from('campaigns').delete().eq('id', id);
//     if (error) throw error;
//     res.send({ success: true, message: 'Campaign deleted successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.get('/campaigns/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { data, error } = await supabase
//       .from('campaigns')
//       .select('*')
//       .eq('id', id)
//       .single();
//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.patch('/campaigns/:id', verifyJWT, async (req, res) => {
//   const { id } = req.params;
//   const updatedData = req.body;
//   try {
//     const { data, error } = await supabase
//       .from('campaigns')
//       .update(updatedData)
//       .eq('id', id)
//       .select();
//     if (error) throw error;
//     res.send({ success: true, modifiedCount: data.length });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   }
// });

// app.get('/payments', verifyJWT, async (req, res) => {
//   const { email } = req.query;
//   try {
//     const { data, error } = await supabase
//       .from('payments')
//       .select('*')
//       .eq('email', email)
//       .order('paid_at', { ascending: false });

//     if (error) throw error;
//     res.send(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.post('/create-payment-intent', verifyJWT, async (req, res) => {
//   const { amountInCents } = req.body;
//   if (!amountInCents)
//     return res.status(400).send({ message: 'Amount required' });

//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: amountInCents,
//       currency: 'usd',
//       payment_method_types: ['card'],
//     });
//     res.send({ clientSecret: paymentIntent.client_secret });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.post('/payments', verifyJWT, async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('payments')
//       .insert([{ ...req.body, paid_at: new Date() }])
//       .select();
//     if (error) throw error;
//     res.status(201).send({ insertedId: data?.[0]?.id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// app.get('/admin/total-donations', verifyJWT, verifyAdmin, async (req, res) => {
//   try {
//     const { data, error } = await supabase.from('payments').select('amount');
//     if (error) throw error;
//     const total =
//       data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
//     res.send({ total, count: data?.length || 0 });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// });

// // Health Check
// app.get('/', (req, res) =>
//   res.send('🐶 Pet Adoption Pure Supabase Server is running')
// );

// app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ✅ ১. Stripe Initialize
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ ২. Supabase Service Client Initialize
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const port = process.env.PORT || 5000;

// ✅ ৩. Middleware
app.use(
  cors({
    origin: ['https://adopt-pet-client.vercel.app', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());

// --- 🛡️ ৪. Auth Middlewares ---

// ইউজারের টোকেন ভেরিফাই করার জন্য
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = authHeader.split(' ')[1];

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(403).send({ message: 'Forbidden access' });
  }

  req.user = user;
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

// ------------------------ ৫. STRIPE PAYMENT ROUTE ------------------------

// Stripe Card Payment Intent তৈরি করা (নিরাপত্তার জন্য এটি ব্যাকএন্ডেই থাকা আবশ্যক)
app.post('/create-payment-intent', verifyJWT, async (req, res) => {
  const { amountInCents } = req.body;
  if (!amountInCents) {
    return res.status(400).send({ message: 'Amount in cents is required' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountInCents),
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe Error:', error.message);
    res.status(500).send({ message: 'Failed to create payment intent' });
  }
});

// ------------------------ ৬. USER ROLE MANAGEMENT (ADMIN ONLY) ------------------------

// ইউজারের রোল আপডেট (যেমন: user থেকে admin করা)
app.patch('/users/role', verifyJWT, verifyAdmin, async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).send({ message: 'Email and role are required' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('email', email);

    if (error) throw error;
    res.send({ success: true, message: `User role updated to ${role}` });
  } catch (err) {
    console.error('Role Update Error:', err.message);
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

// ইউজারের রোল চেক করা
app.get('/users/role/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) {
      return res.send({ role: 'not_found' });
    }
    res.send({ role: data.role });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// ------------------------ ৭. HEALTH CHECK ------------------------

app.get('/', (req, res) =>
  res.send('🐶 Pet Adoption Lean & Secure Server is running')
);

app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
