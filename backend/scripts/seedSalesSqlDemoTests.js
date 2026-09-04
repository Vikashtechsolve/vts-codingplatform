/**
 * Seed 5 SQL dataset templates + 5 SQL tests for sales@skilltrixa.com.
 * Every correct query is executed in the SQLite sandbox before save.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Test = require('../models/Test');
const DatasetTemplate = require('../models/DatasetTemplate');
const SQLQuestion = require('../models/SQLQuestion');
const { runInSandbox, getExpectedOutputHash } = require('../utils/sqlSandbox');

const SOURCE_EMAIL = 'sales@skilltrixa.com';

const TEST_TITLES = [
  'SQL Assessment – HR Analytics',
  'SQL Assessment – Banking Operations',
  'SQL Assessment – Sales Pipeline',
  'SQL Assessment – E-Commerce Analytics',
  'SQL Assessment – Campus Academics',
];

const TEMPLATE_NAMES = [
  'Demo HR – Talent & Projects',
  'Demo Banking – Retail Ledger',
  'Demo Sales – Pipeline CRM',
  'Demo E-commerce – Marketplace',
  'Demo Campus – Course Registration',
];

function execSchema(schemaSql, dataSql, label) {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  try {
    db.exec(schemaSql);
    db.exec(dataSql);
  } catch (err) {
    throw new Error(`${label}: schema/data failed: ${err.message}`);
  } finally {
    db.close();
  }
}

function mustHash(schemaSql, dataSql, sql, label) {
  const run = runInSandbox(schemaSql, dataSql, sql);
  if (!run.success) {
    throw new Error(`${label}: query failed: ${run.error}\nSQL:\n${sql}`);
  }
  if (!run.rows.length) {
    throw new Error(`${label}: query returned 0 rows (bad for demo)\nSQL:\n${sql}`);
  }
  const hash = getExpectedOutputHash(schemaSql, dataSql, sql);
  if (!hash || hash !== run.outputHash) {
    throw new Error(`${label}: hash mismatch`);
  }
  return { hash, rowCount: run.rows.length };
}

const DATASETS = [
  {
    templateName: TEMPLATE_NAMES[0],
    domain: 'HR',
    description:
      'Human-resources dataset: departments, employees (with managers), projects, and allocations. Use it for JOIN, GROUP BY, and subquery practice.',
    testTitle: TEST_TITLES[0],
    testDescription:
      'Six SQL questions on a company HR database: filters, joins, aggregations, HAVING, subqueries, and a self-join for managers.',
    duration: 50,
    schemaSql: `
CREATE TABLE departments (
  dept_id INTEGER PRIMARY KEY,
  dept_name TEXT NOT NULL,
  location TEXT NOT NULL
);

CREATE TABLE employees (
  emp_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  salary INTEGER NOT NULL,
  hire_date TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  manager_id INTEGER,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  FOREIGN KEY (manager_id) REFERENCES employees(emp_id)
);

CREATE TABLE projects (
  project_id INTEGER PRIMARY KEY,
  project_name TEXT NOT NULL,
  budget INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE employee_projects (
  emp_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  hours_allocated INTEGER NOT NULL,
  PRIMARY KEY (emp_id, project_id),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
`.trim(),
    dataSql: `
INSERT INTO departments (dept_id, dept_name, location) VALUES
  (1, 'Engineering', 'Bengaluru'),
  (2, 'Human Resources', 'Mumbai'),
  (3, 'Sales', 'Delhi'),
  (4, 'Finance', 'Mumbai'),
  (5, 'Customer Support', 'Hyderabad');

INSERT INTO employees (emp_id, first_name, last_name, email, salary, hire_date, dept_id, manager_id) VALUES
  (1, 'Ananya', 'Iyer', 'ananya.iyer@skilltrixa.com', 180000, '2018-03-12', 1, NULL),
  (2, 'Rohit', 'Mehta', 'rohit.mehta@skilltrixa.com', 145000, '2019-07-01', 1, 1),
  (3, 'Priya', 'Nair', 'priya.nair@skilltrixa.com', 132000, '2020-01-15', 1, 1),
  (4, 'Karthik', 'Rao', 'karthik.rao@skilltrixa.com', 98000, '2021-06-20', 1, 2),
  (5, 'Sneha', 'Kulkarni', 'sneha.kulkarni@skilltrixa.com', 110000, '2019-11-04', 2, 1),
  (6, 'Aman', 'Verma', 'aman.verma@skilltrixa.com', 72000, '2022-02-14', 2, 5),
  (7, 'Neha', 'Sharma', 'neha.sharma@skilltrixa.com', 125000, '2018-09-10', 3, 1),
  (8, 'Vikram', 'Singh', 'vikram.singh@skilltrixa.com', 88000, '2021-04-03', 3, 7),
  (9, 'Divya', 'Patel', 'divya.patel@skilltrixa.com', 91000, '2020-08-22', 3, 7),
  (10, 'Arjun', 'Desai', 'arjun.desai@skilltrixa.com', 140000, '2017-12-01', 4, 1),
  (11, 'Meera', 'Joshi', 'meera.joshi@skilltrixa.com', 76000, '2023-01-09', 4, 10),
  (12, 'Farhan', 'Ali', 'farhan.ali@skilltrixa.com', 64000, '2022-10-18', 5, 1),
  (13, 'Isha', 'Gupta', 'isha.gupta@skilltrixa.com', 61000, '2023-05-02', 5, 12);

INSERT INTO projects (project_id, project_name, budget, status) VALUES
  (1, 'Campus Portal', 2500000, 'Active'),
  (2, 'Payroll Revamp', 800000, 'Active'),
  (3, 'Sales CRM', 1200000, 'Completed'),
  (4, 'Support Chatbot', 450000, 'On Hold');

INSERT INTO employee_projects (emp_id, project_id, hours_allocated) VALUES
  (2, 1, 30),
  (3, 1, 25),
  (4, 1, 20),
  (5, 2, 15),
  (10, 2, 12),
  (7, 3, 18),
  (8, 3, 22),
  (9, 3, 10),
  (12, 4, 16),
  (13, 4, 8),
  (3, 4, 6);
`.trim(),
    questions: [
      {
        text: "List every employee's first name, last name, and salary, ordered by salary from highest to lowest.",
        marks: 8,
        correctSql: 'SELECT first_name, last_name, salary FROM employees ORDER BY salary DESC;',
      },
      {
        text: 'Show the first name, last name, and department name of all employees who work in Engineering.',
        marks: 10,
        correctSql: `SELECT e.first_name, e.last_name, d.dept_name
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
WHERE d.dept_name = 'Engineering';`,
      },
      {
        text: 'For each department, display the department name and the number of employees. Order by employee count descending.',
        marks: 10,
        correctSql: `SELECT d.dept_name, COUNT(e.emp_id) AS employee_count
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY employee_count DESC;`,
      },
      {
        text: 'List department names that have more than 2 employees, along with the employee count.',
        marks: 12,
        correctSql: `SELECT d.dept_name, COUNT(e.emp_id) AS employee_count
FROM departments d
JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_id, d.dept_name
HAVING COUNT(e.emp_id) > 2;`,
      },
      {
        text: 'Find employees whose salary is strictly greater than the average salary of all employees. Return first name, last name, and salary.',
        marks: 12,
        correctSql: `SELECT first_name, last_name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);`,
      },
      {
        text: "List each employee (except the CEO) with their manager's first and last name. Columns: employee_name (first + space + last), manager_name.",
        marks: 13,
        correctSql: `SELECT e.first_name || ' ' || e.last_name AS employee_name,
       m.first_name || ' ' || m.last_name AS manager_name
FROM employees e
JOIN employees m ON e.manager_id = m.emp_id
ORDER BY employee_name;`,
      },
    ],
  },
  {
    templateName: TEMPLATE_NAMES[1],
    domain: 'Banking',
    description:
      'Retail banking ledger: branches, customers, accounts, and transactions. Practice joins, balances, and credit/debit aggregations.',
    testTitle: TEST_TITLES[1],
    testDescription:
      'SQL paper on a retail bank: customer filters, account joins, branch balances, transaction types, and multi-account customers.',
    duration: 50,
    schemaSql: `
CREATE TABLE branches (
  branch_id INTEGER PRIMARY KEY,
  branch_name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  city TEXT NOT NULL,
  kyc_status TEXT NOT NULL
);

CREATE TABLE accounts (
  account_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  account_type TEXT NOT NULL,
  opened_on TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

CREATE TABLE transactions (
  txn_id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  txn_date TEXT NOT NULL,
  txn_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
`.trim(),
    dataSql: `
INSERT INTO branches (branch_id, branch_name, city) VALUES
  (1, 'MG Road', 'Bengaluru'),
  (2, 'Bandra West', 'Mumbai'),
  (3, 'Connaught Place', 'Delhi'),
  (4, 'Banjara Hills', 'Hyderabad');

INSERT INTO customers (customer_id, full_name, city, kyc_status) VALUES
  (1, 'Ravi Kumar', 'Bengaluru', 'Verified'),
  (2, 'Anita Shah', 'Mumbai', 'Verified'),
  (3, 'Imran Khan', 'Delhi', 'Pending'),
  (4, 'Lakshmi Reddy', 'Hyderabad', 'Verified'),
  (5, 'John Mathew', 'Bengaluru', 'Verified'),
  (6, 'Pooja Nanda', 'Mumbai', 'Verified'),
  (7, 'Sanjay Gupta', 'Delhi', 'Verified');

INSERT INTO accounts (account_id, customer_id, branch_id, account_type, opened_on, status) VALUES
  (101, 1, 1, 'Savings', '2019-04-11', 'Active'),
  (102, 1, 1, 'Current', '2021-08-02', 'Active'),
  (103, 2, 2, 'Savings', '2018-01-20', 'Active'),
  (104, 3, 3, 'Savings', '2022-03-15', 'Active'),
  (105, 4, 4, 'Savings', '2020-07-09', 'Active'),
  (106, 5, 1, 'Savings', '2017-11-30', 'Closed'),
  (107, 5, 1, 'Current', '2023-02-01', 'Active'),
  (108, 6, 2, 'Savings', '2021-05-18', 'Active'),
  (109, 7, 3, 'Current', '2019-09-25', 'Active');

INSERT INTO transactions (txn_id, account_id, txn_date, txn_type, amount) VALUES
  (1, 101, '2024-01-05', 'Credit', 50000),
  (2, 101, '2024-01-12', 'Debit', 12000),
  (3, 101, '2024-02-01', 'Credit', 8000),
  (4, 102, '2024-01-10', 'Credit', 200000),
  (5, 102, '2024-01-20', 'Debit', 45000),
  (6, 103, '2024-01-08', 'Credit', 75000),
  (7, 103, '2024-02-02', 'Debit', 5000),
  (8, 104, '2024-01-15', 'Credit', 15000),
  (9, 105, '2024-01-18', 'Credit', 90000),
  (10, 105, '2024-02-05', 'Debit', 20000),
  (11, 107, '2024-01-22', 'Credit', 300000),
  (12, 107, '2024-02-10', 'Debit', 25000),
  (13, 108, '2024-01-11', 'Credit', 40000),
  (14, 109, '2024-01-09', 'Credit', 120000),
  (15, 109, '2024-02-14', 'Debit', 18000);
`.trim(),
    questions: [
      {
        text: 'List the full name and city of every customer whose KYC status is Verified, ordered by full_name.',
        marks: 8,
        correctSql: `SELECT full_name, city
FROM customers
WHERE kyc_status = 'Verified'
ORDER BY full_name;`,
      },
      {
        text: 'Show each active account with the customer full name, account type, and branch name.',
        marks: 10,
        correctSql: `SELECT c.full_name, a.account_type, b.branch_name
FROM accounts a
JOIN customers c ON a.customer_id = c.customer_id
JOIN branches b ON a.branch_id = b.branch_id
WHERE a.status = 'Active'
ORDER BY c.full_name, a.account_type;`,
      },
      {
        text: 'Compute the current balance of each account as SUM(credits) minus SUM(debits). Return account_id and balance. Treat missing debits/credits as 0.',
        marks: 12,
        correctSql: `SELECT a.account_id,
       COALESCE(SUM(CASE WHEN t.txn_type = 'Credit' THEN t.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN t.txn_type = 'Debit' THEN t.amount ELSE 0 END), 0) AS balance
FROM accounts a
LEFT JOIN transactions t ON a.account_id = t.account_id
GROUP BY a.account_id
ORDER BY a.account_id;`,
      },
      {
        text: 'List customers who hold more than one account (any status). Return full_name and the number of accounts.',
        marks: 10,
        correctSql: `SELECT c.full_name, COUNT(a.account_id) AS account_count
FROM customers c
JOIN accounts a ON c.customer_id = a.customer_id
GROUP BY c.customer_id, c.full_name
HAVING COUNT(a.account_id) > 1;`,
      },
      {
        text: 'Find the total debit amount withdrawn in February 2024 (txn_date starts with 2024-02). Return a single column named total_february_debits.',
        marks: 10,
        correctSql: `SELECT SUM(amount) AS total_february_debits
FROM transactions
WHERE txn_type = 'Debit' AND txn_date LIKE '2024-02%';`,
      },
      {
        text: 'For each city, show how many verified customers live there. Include cities with zero verified customers if they appear on a customer row. Order by customer_count descending.',
        marks: 12,
        correctSql: `SELECT city, COUNT(*) AS customer_count
FROM customers
WHERE kyc_status = 'Verified'
GROUP BY city
ORDER BY customer_count DESC, city;`,
      },
    ],
  },
  {
    templateName: TEMPLATE_NAMES[2],
    domain: 'Sales',
    description:
      'B2B sales CRM: regions, sales representatives, and deals with stages and amounts.',
    testTitle: TEST_TITLES[2],
    testDescription:
      'Pipeline SQL: open deals, joins to regions, won revenue by rep, average deal size, and top region.',
    duration: 50,
    schemaSql: `
CREATE TABLE regions (
  region_id INTEGER PRIMARY KEY,
  region_name TEXT NOT NULL,
  country TEXT NOT NULL
);

CREATE TABLE sales_reps (
  rep_id INTEGER PRIMARY KEY,
  rep_name TEXT NOT NULL,
  region_id INTEGER NOT NULL,
  quota INTEGER NOT NULL,
  FOREIGN KEY (region_id) REFERENCES regions(region_id)
);

CREATE TABLE deals (
  deal_id INTEGER PRIMARY KEY,
  deal_name TEXT NOT NULL,
  rep_id INTEGER NOT NULL,
  stage TEXT NOT NULL,
  amount INTEGER NOT NULL,
  close_date TEXT,
  FOREIGN KEY (rep_id) REFERENCES sales_reps(rep_id)
);
`.trim(),
    dataSql: `
INSERT INTO regions (region_id, region_name, country) VALUES
  (1, 'West India', 'India'),
  (2, 'South India', 'India'),
  (3, 'North India', 'India'),
  (4, 'SEA', 'Singapore');

INSERT INTO sales_reps (rep_id, rep_name, region_id, quota) VALUES
  (1, 'Aditi Rao', 2, 800000),
  (2, 'Manish Kapoor', 1, 600000),
  (3, 'Leena Bose', 3, 500000),
  (4, 'Chen Wei', 4, 400000),
  (5, 'Rahul Bhatt', 1, 550000);

INSERT INTO deals (deal_id, deal_name, rep_id, stage, amount, close_date) VALUES
  (1, 'NovaTech campus licence', 1, 'Closed Won', 420000, '2024-01-18'),
  (2, 'Pinnacle ATS', 1, 'Negotiation', 180000, NULL),
  (3, 'Harbor Bank LMS', 2, 'Closed Won', 310000, '2024-02-03'),
  (4, 'Orbit Retail POS', 2, 'Closed Lost', 90000, '2024-01-22'),
  (5, 'NorthGrid hiring', 3, 'Proposal', 150000, NULL),
  (6, 'Delhi Metro training', 3, 'Closed Won', 220000, '2024-02-12'),
  (7, 'LionPay wallet', 4, 'Closed Won', 275000, '2024-01-30'),
  (8, 'SEA Campus pack', 4, 'Qualified', 95000, NULL),
  (9, 'WestEnd manufacturing', 5, 'Closed Won', 190000, '2024-02-08'),
  (10, 'Mumbai FinTech', 5, 'Negotiation', 260000, NULL),
  (11, 'Hyderabad GCCs', 1, 'Closed Won', 155000, '2024-02-20'),
  (12, 'Jaipur colleges', 3, 'Qualified', 70000, NULL);
`.trim(),
    questions: [
      {
        text: 'List deal_name, stage, and amount for deals that are still open (stage is not Closed Won and not Closed Lost). Order by amount descending.',
        marks: 8,
        correctSql: `SELECT deal_name, stage, amount
FROM deals
WHERE stage NOT IN ('Closed Won', 'Closed Lost')
ORDER BY amount DESC;`,
      },
      {
        text: 'Show each sales rep with their region name and quota.',
        marks: 8,
        correctSql: `SELECT r.rep_name, g.region_name, r.quota
FROM sales_reps r
JOIN regions g ON r.region_id = g.region_id
ORDER BY r.rep_name;`,
      },
      {
        text: 'For each sales rep, compute total Closed Won amount. Return rep_name and won_amount. Include reps with zero wins using 0.',
        marks: 12,
        correctSql: `SELECT r.rep_name,
       COALESCE(SUM(CASE WHEN d.stage = 'Closed Won' THEN d.amount ELSE 0 END), 0) AS won_amount
FROM sales_reps r
LEFT JOIN deals d ON r.rep_id = d.rep_id
GROUP BY r.rep_id, r.rep_name
ORDER BY won_amount DESC;`,
      },
      {
        text: 'Calculate the average deal amount per stage. Return stage and avg_amount rounded to the nearest integer using ROUND. Order by avg_amount descending.',
        marks: 10,
        correctSql: `SELECT stage, ROUND(AVG(amount)) AS avg_amount
FROM deals
GROUP BY stage
ORDER BY avg_amount DESC;`,
      },
      {
        text: 'List sales reps whose total Closed Won amount is at least 250000. Return rep_name and won_amount.',
        marks: 12,
        correctSql: `SELECT r.rep_name, SUM(d.amount) AS won_amount
FROM sales_reps r
JOIN deals d ON r.rep_id = d.rep_id
WHERE d.stage = 'Closed Won'
GROUP BY r.rep_id, r.rep_name
HAVING SUM(d.amount) >= 250000
ORDER BY won_amount DESC;`,
      },
      {
        text: 'Which region has the highest Closed Won revenue? Return region_name and total_won only for that top region.',
        marks: 12,
        correctSql: `SELECT g.region_name, SUM(d.amount) AS total_won
FROM regions g
JOIN sales_reps r ON g.region_id = r.region_id
JOIN deals d ON r.rep_id = d.rep_id
WHERE d.stage = 'Closed Won'
GROUP BY g.region_id, g.region_name
ORDER BY total_won DESC
LIMIT 1;`,
      },
    ],
  },
  {
    templateName: TEMPLATE_NAMES[3],
    domain: 'E-commerce',
    description:
      'Marketplace dataset: categories, products, customers, orders, and line items with quantities and unit prices.',
    testTitle: TEST_TITLES[3],
    testDescription:
      'E-commerce SQL: product filters, order joins, line-item revenue, repeat customers, and top category.',
    duration: 55,
    schemaSql: `
CREATE TABLE categories (
  category_id INTEGER PRIMARY KEY,
  category_name TEXT NOT NULL
);

CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  product_name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  city TEXT NOT NULL,
  joined_on TEXT NOT NULL
);

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE order_items (
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);
`.trim(),
    dataSql: `
INSERT INTO categories (category_id, category_name) VALUES
  (1, 'Electronics'),
  (2, 'Books'),
  (3, 'Apparel'),
  (4, 'Home');

INSERT INTO products (product_id, product_name, category_id, unit_price, stock) VALUES
  (1, 'Wireless Mouse', 1, 799, 120),
  (2, 'USB-C Hub', 1, 1499, 45),
  (3, 'Laptop Stand', 1, 2499, 30),
  (4, 'SQL Workbook', 2, 499, 200),
  (5, 'System Design Notes', 2, 699, 80),
  (6, 'Campus Hoodie', 3, 1299, 60),
  (7, 'Desk Lamp', 4, 899, 40),
  (8, 'Notebook Pack', 2, 199, 300);

INSERT INTO customers (customer_id, customer_name, city, joined_on) VALUES
  (1, 'Aisha Khan', 'Pune', '2023-01-10'),
  (2, 'Dev Patel', 'Ahmedabad', '2023-03-22'),
  (3, 'Nisha Reddy', 'Hyderabad', '2022-11-05'),
  (4, 'Omar Siddiqui', 'Lucknow', '2024-01-14'),
  (5, 'Kavya Menon', 'Kochi', '2023-07-19');

INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
  (1001, 1, '2024-02-01', 'Delivered'),
  (1002, 1, '2024-02-18', 'Delivered'),
  (1003, 2, '2024-02-03', 'Shipped'),
  (1004, 3, '2024-02-05', 'Delivered'),
  (1005, 3, '2024-02-21', 'Cancelled'),
  (1006, 4, '2024-02-09', 'Delivered'),
  (1007, 5, '2024-02-11', 'Delivered');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1001, 1, 2, 799),
  (1001, 4, 1, 499),
  (1002, 6, 1, 1299),
  (1002, 8, 3, 199),
  (1003, 2, 1, 1499),
  (1003, 3, 1, 2499),
  (1004, 5, 2, 699),
  (1004, 4, 1, 499),
  (1005, 7, 1, 899),
  (1006, 1, 1, 799),
  (1006, 7, 2, 899),
  (1007, 6, 2, 1299),
  (1007, 8, 1, 199);
`.trim(),
    questions: [
      {
        text: 'List product_name and unit_price for products priced below 1000, ordered by unit_price ascending.',
        marks: 8,
        correctSql: `SELECT product_name, unit_price
FROM products
WHERE unit_price < 1000
ORDER BY unit_price ASC;`,
      },
      {
        text: 'Show each non-cancelled order with the customer name, order date, and status. Order by order_date.',
        marks: 10,
        correctSql: `SELECT o.order_id, c.customer_name, o.order_date, o.status
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.status <> 'Cancelled'
ORDER BY o.order_date;`,
      },
      {
        text: 'Compute revenue per product as SUM(quantity * unit_price) from order_items. Exclude cancelled orders. Return product_name and revenue, ordered by revenue descending.',
        marks: 12,
        correctSql: `SELECT p.product_name, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.status <> 'Cancelled'
GROUP BY p.product_id, p.product_name
ORDER BY revenue DESC;`,
      },
      {
        text: 'Find customers who placed more than one order (including cancelled). Return customer_name and order_count.',
        marks: 10,
        correctSql: `SELECT c.customer_name, COUNT(o.order_id) AS order_count
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(o.order_id) > 1;`,
      },
      {
        text: 'List order_id and order_total for delivered orders whose line-item total is greater than 2000. order_total = SUM(quantity * unit_price).',
        marks: 12,
        correctSql: `SELECT o.order_id, SUM(oi.quantity * oi.unit_price) AS order_total
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.status = 'Delivered'
GROUP BY o.order_id
HAVING SUM(oi.quantity * oi.unit_price) > 2000
ORDER BY order_total DESC;`,
      },
      {
        text: 'Which category has the highest revenue from non-cancelled orders? Return category_name and revenue for the top category only.',
        marks: 13,
        correctSql: `SELECT c.category_name, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.status <> 'Cancelled'
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC
LIMIT 1;`,
      },
    ],
  },
  {
    templateName: TEMPLATE_NAMES[4],
    domain: 'General',
    description:
      'University registration: faculty, courses, students, and enrollments with numeric marks.',
    testTitle: TEST_TITLES[4],
    testDescription:
      'Campus academics SQL: credit filters, course enrollments, averages, and faculty teaching load.',
    duration: 50,
    schemaSql: `
CREATE TABLE faculty (
  faculty_id INTEGER PRIMARY KEY,
  faculty_name TEXT NOT NULL,
  department TEXT NOT NULL
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  credits INTEGER NOT NULL,
  faculty_id INTEGER NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id)
);

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  student_name TEXT NOT NULL,
  program TEXT NOT NULL,
  year INTEGER NOT NULL
);

CREATE TABLE enrollments (
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  semester TEXT NOT NULL,
  marks INTEGER NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);
`.trim(),
    dataSql: `
INSERT INTO faculty (faculty_id, faculty_name, department) VALUES
  (1, 'Dr. Kavitha Menon', 'Computer Science'),
  (2, 'Prof. Rajesh Iyer', 'Computer Science'),
  (3, 'Dr. Nina D''Souza', 'Mathematics'),
  (4, 'Prof. Amit Vyas', 'Electronics');

INSERT INTO courses (course_id, course_code, course_title, credits, faculty_id) VALUES
  (1, 'CS201', 'Database Systems', 4, 1),
  (2, 'CS305', 'Operating Systems', 4, 2),
  (3, 'CS210', 'Data Structures', 3, 2),
  (4, 'MA110', 'Discrete Mathematics', 3, 3),
  (5, 'EC220', 'Digital Logic', 4, 4),
  (6, 'CS401', 'System Design Lab', 2, 1);

INSERT INTO students (student_id, student_name, program, year) VALUES
  (1, 'Harini S', 'B.Tech CSE', 2),
  (2, 'Mohit Jain', 'B.Tech CSE', 3),
  (3, 'Tara Fernandes', 'B.Tech ECE', 2),
  (4, 'Yash Agarwal', 'B.Tech CSE', 3),
  (5, 'Riya Sen', 'B.Tech CSE', 2),
  (6, 'Paul George', 'B.Tech ECE', 3);

INSERT INTO enrollments (student_id, course_id, semester, marks) VALUES
  (1, 1, '2024-Spring', 88),
  (1, 4, '2024-Spring', 74),
  (1, 3, '2024-Spring', 81),
  (2, 1, '2024-Spring', 92),
  (2, 2, '2024-Spring', 79),
  (2, 6, '2024-Spring', 85),
  (3, 5, '2024-Spring', 70),
  (3, 4, '2024-Spring', 66),
  (3, 1, '2024-Spring', 73),
  (4, 2, '2024-Spring', 84),
  (4, 6, '2024-Spring', 90),
  (4, 1, '2024-Spring', 77),
  (5, 3, '2024-Spring', 95),
  (5, 4, '2024-Spring', 89),
  (6, 5, '2024-Spring', 62),
  (6, 2, '2024-Spring', 68);
`.trim(),
    questions: [
      {
        text: 'List course_code, course_title, and credits for every course that has at least 4 credits, ordered by course_code.',
        marks: 8,
        correctSql: `SELECT course_code, course_title, credits
FROM courses
WHERE credits >= 4
ORDER BY course_code;`,
      },
      {
        text: 'Show student_name and marks for everyone enrolled in Database Systems (course title exact match). Order by marks descending.',
        marks: 10,
        correctSql: `SELECT s.student_name, e.marks
FROM enrollments e
JOIN students s ON e.student_id = s.student_id
JOIN courses c ON e.course_id = c.course_id
WHERE c.course_title = 'Database Systems'
ORDER BY e.marks DESC;`,
      },
      {
        text: 'For each course, display course_code and the number of enrolled students as enrollment_count. Include courses with zero enrollments. Order by enrollment_count descending.',
        marks: 10,
        correctSql: `SELECT c.course_code, COUNT(e.student_id) AS enrollment_count
FROM courses c
LEFT JOIN enrollments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.course_code
ORDER BY enrollment_count DESC, c.course_code;`,
      },
      {
        text: 'List students whose average marks across enrollments is at least 80. Return student_name and ROUND(AVG(marks)) AS avg_marks.',
        marks: 12,
        correctSql: `SELECT s.student_name, ROUND(AVG(e.marks)) AS avg_marks
FROM students s
JOIN enrollments e ON s.student_id = e.student_id
GROUP BY s.student_id, s.student_name
HAVING AVG(e.marks) >= 80
ORDER BY avg_marks DESC;`,
      },
      {
        text: 'Which faculty members teach more than one course? Return faculty_name and course_count.',
        marks: 10,
        correctSql: `SELECT f.faculty_name, COUNT(c.course_id) AS course_count
FROM faculty f
JOIN courses c ON f.faculty_id = c.faculty_id
GROUP BY f.faculty_id, f.faculty_name
HAVING COUNT(c.course_id) > 1;`,
      },
      {
        text: 'Find the highest marks scored in each department (faculty.department). Return department and max_marks.',
        marks: 12,
        correctSql: `SELECT f.department, MAX(e.marks) AS max_marks
FROM enrollments e
JOIN courses c ON e.course_id = c.course_id
JOIN faculty f ON c.faculty_id = f.faculty_id
GROUP BY f.department
ORDER BY max_marks DESC;`,
      },
    ],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: SOURCE_EMAIL, role: 'vendor_admin', isActive: true });
  if (!admin?.vendorId) throw new Error(`Vendor admin not found: ${SOURCE_EMAIL}`);
  const vendorId = admin.vendorId;
  const createdBy = admin._id;

  const existingTests = await Test.find({ vendorId, title: { $in: TEST_TITLES } }).select('title').lean();
  if (existingTests.length) {
    throw new Error(`Demo SQL tests already exist: ${existingTests.map((t) => t.title).join('; ')}`);
  }
  const existingTemplates = await DatasetTemplate.find({ vendorId, name: { $in: TEMPLATE_NAMES } }).select('name').lean();
  if (existingTemplates.length) {
    throw new Error(`Demo templates already exist: ${existingTemplates.map((t) => t.name).join('; ')}`);
  }

  const created = [];

  for (const ds of DATASETS) {
    console.log(`\nValidating ${ds.templateName}...`);
    execSchema(ds.schemaSql, ds.dataSql, ds.templateName);

    const preparedQuestions = ds.questions.map((q, idx) => {
      const { hash, rowCount } = mustHash(
        ds.schemaSql,
        ds.dataSql,
        q.correctSql,
        `${ds.templateName} Q${idx + 1}`
      );
      console.log(`  Q${idx + 1} ok (${rowCount} rows, ${q.marks} marks)`);
      return { ...q, hash, order: idx + 1 };
    });

    const template = await DatasetTemplate.create({
      name: ds.templateName,
      description: ds.description,
      domain: ds.domain,
      vendorId,
      isPlatform: false,
      schemaSql: ds.schemaSql,
      dataSql: ds.dataSql,
      version: 1,
      isPublished: true,
      publishedAt: new Date(),
    });

    const test = await Test.create({
      title: ds.testTitle,
      description: ds.testDescription,
      vendorId,
      createdBy,
      type: 'sql',
      source: 'vendor',
      datasetTemplateId: template._id,
      duration: ds.duration,
      questions: [],
      isActive: true,
      settings: {
        allowMultipleAttempts: false,
        autoSubmitAtWindowEnd: true,
        showResults: true,
        resultDisplay: 'detailed',
        shuffleQuestions: false,
        practiceMode: false,
      },
    });

    const sqlDocs = [];
    const testQuestions = [];
    for (const q of preparedQuestions) {
      const id = new mongoose.Types.ObjectId();
      sqlDocs.push({
        _id: id,
        testId: test._id,
        vendorId,
        text: q.text,
        marks: q.marks,
        correctSql: q.correctSql,
        expectedOutputHash: q.hash,
        order: q.order,
      });
      testQuestions.push({
        type: 'sql',
        questionId: id,
        questionType: 'SQLQuestion',
        points: q.marks,
        order: q.order,
      });
    }

    await SQLQuestion.insertMany(sqlDocs);
    test.questions = testQuestions;
    await test.save();

    const stored = await SQLQuestion.find({ testId: test._id }).sort({ order: 1 });
    for (const q of stored) {
      const run = runInSandbox(ds.schemaSql, ds.dataSql, q.correctSql);
      if (!run.success || run.outputHash !== q.expectedOutputHash) {
        throw new Error(`Post-save validation failed for ${ds.testTitle} order ${q.order}: ${run.error || 'hash mismatch'}`);
      }
    }

    created.push({
      template: ds.templateName,
      domain: ds.domain,
      test: ds.testTitle,
      duration: ds.duration,
      questions: stored.length,
      totalMarks: stored.reduce((s, q) => s + q.marks, 0),
    });
  }

  await Vendor.updateOne({ _id: vendorId }, { $inc: { 'stats.totalTests': created.length } });

  console.log('\n' + JSON.stringify({ ok: true, created }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nSEED FAILED:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
